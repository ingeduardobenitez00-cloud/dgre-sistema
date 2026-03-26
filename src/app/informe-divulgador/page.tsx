
"use client";

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/header';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useFirebase, useUser, useCollection } from '@/firebase';
import { collection, doc, setDoc, query, where, Timestamp } from 'firebase/firestore';
import { type SolicitudCapacitacion, type InformeDivulgador } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileText, ChevronsUpDown, Check, Calendar, User, X, Camera } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn, formatDateToDDMMYYYY } from '@/lib/utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import Link from 'next/link';
import { Dialog, DialogContent } from '@/components/ui/dialog';

function InformeContent() {
  const { firestore } = useFirebase();
  const { user, isUserLoading, profile: userProfile } = useUser();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const solicitudIdFromUrl = searchParams.get('solicitudId');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedActivityKey, setSelectedActivityKey] = useState<string | undefined>(undefined);

  // Estados de Cámara
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const videoRef = (typeof window !== 'undefined') ? { current: null as any } : { current: null }; // Placeholder para SSR

  // Consulta de informes ya presentados para evitar duplicados
  const informesQuery = useMemo(() => (firestore ? collection(firestore, 'informes-divulgador') : null), [firestore]);
  const { data: submittedInformes } = useCollection<InformeDivulgador>(informesQuery);

  // Consulta centralizada de solicitudes (Anexo I y V están aquí)
  const solicitudesQuery = useMemo(() => {
    if (!firestore || !userProfile || !user?.uid) return null;
    const colRef = collection(firestore, 'solicitudes-capacitacion');
    
    // Filtros por jurisdicción básicos
    const role = userProfile.role;
    const permissions = userProfile.permissions || [];
    const isManager = role === 'admin' || role === 'director' || permissions.includes('admin_filter');

    if (isManager) return colRef;
    
    if (permissions.includes('department_filter') && userProfile.departamento) {
        return query(colRef, where('departamento', '==', userProfile.departamento));
    }
    
    if (role === 'jefe' || permissions.includes('district_filter')) {
        return query(colRef, where('departamento', '==', userProfile.departamento), where('distrito', '==', userProfile.distrito));
    }

    return colRef; // Divulgadores filtran en memoria para mayor robustez
  }, [firestore, user, userProfile]);

  const { data: rawSolicitudes, isLoading: isLoadingSolicitudes } = useCollection<SolicitudCapacitacion>(solicitudesQuery);

  // Lógica de vinculación: Filtra actividades activas donde el usuario está asignado
  const linkedActivities = useMemo(() => {
    if (!rawSolicitudes || !user || !userProfile) return [];
    
    const submittedReportKeys = new Set(submittedInformes?.map(inf => `${inf.solicitud_id}_${inf.divulgador_id}`) || []);
    const isManager = ['admin', 'director', 'jefe'].includes(userProfile.role || '') || userProfile.permissions?.includes('admin_filter');

    return rawSolicitudes.flatMap(act => {
      if (act.cancelada) return [];
      
      // Obtenemos los divulgadores del evento
      const divulgadores = act.divulgadores || act.asignados || [];
      
      return divulgadores
        .filter(div => {
          // Si es manager, ve todo lo que tenga personal asignado
          if (isManager) return true;
          // Si es divulgador, solo ve donde él esté asignado (por ID)
          return div.id === user.uid;
        })
        .filter(div => !submittedReportKeys.has(`${act.id}_${div.id}`))
        .map(div => ({
          id: `${act.id}-${div.id}`,
          solicitudId: act.id,
          divulgador: div,
          activityData: act,
          label: `${formatDateToDDMMYYYY(act.fecha)} | ${act.lugar_local.toUpperCase()} | ${div.nombre.toUpperCase()}`
        }));
    });
  }, [rawSolicitudes, submittedInformes, user, userProfile]);

  const selectedEntry = useMemo(() => {
    return linkedActivities.find(act => act.id === selectedActivityKey);
  }, [selectedActivityKey, linkedActivities]);

  useEffect(() => {
    if (solicitudIdFromUrl && linkedActivities.length > 0 && !selectedActivityKey) {
      const matching = linkedActivities.find(act => act.solicitudId === solicitudIdFromUrl);
      if (matching) setSelectedActivityKey(matching.id);
    }
  }, [solicitudIdFromUrl, linkedActivities, selectedActivityKey]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firestore || !user || !selectedEntry) {
      toast({ variant: 'destructive', title: 'Error', description: 'Seleccione una actividad válida.' });
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData(event.currentTarget);
    const m = parseInt(formData.get('masculinos') as string || '0');
    const f = parseInt(formData.get('femeninos') as string || '0');
    const o = parseInt(formData.get('otros') as string || '0');

    const informeData: Omit<InformeDivulgador, 'id'> = {
      solicitud_id: selectedEntry.solicitudId,
      divulgador_id: selectedEntry.divulgador.id,
      divulgador_nombre: selectedEntry.divulgador.nombre,
      divulgador_cedula: selectedEntry.divulgador.cedula,
      divulgador_vinculo: selectedEntry.divulgador.vinculo,
      lugar_divulgacion: selectedEntry.activityData.lugar_local,
      fecha: selectedEntry.activityData.fecha,
      hora_desde: selectedEntry.activityData.hora_desde,
      hora_hasta: selectedEntry.activityData.hora_hasta,
      oficina: selectedEntry.activityData.distrito,
      distrito: selectedEntry.activityData.distrito,
      departamento: selectedEntry.activityData.departamento,
      total_personas: m + f + o,
      participantes_masculinos: m,
      participantes_femeninos: f,
      participantes_otros: o,
      observaciones: formData.get('observaciones') as string,
      fecha_creacion: new Date().toISOString(),
      usuario_id: user.uid
    };

    try {
      const docId = `${selectedEntry.solicitudId}_${selectedEntry.divulgador.id}`;
      await setDoc(doc(firestore, 'informes-divulgador', docId), informeData);
      toast({ title: 'Informe Guardado' });
      setSelectedActivityKey(undefined);
      event.currentTarget.reset();
    } catch (error) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'informes-divulgador', operation: 'create' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isUserLoading || isLoadingSolicitudes) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      <Header title="Anexo III - Informe del Divulgador" />
      <main className="flex-1 p-4 md:p-8 flex items-center justify-center">
        <form onSubmit={handleSubmit} className="w-full max-w-2xl">
          <Card className="shadow-2xl border-none rounded-[2rem] overflow-hidden bg-white">
            <CardHeader className="border-b py-8 bg-black text-white">
                <div className="flex items-center justify-between">
                    <CardTitle className="uppercase font-black tracking-widest text-sm flex items-center gap-3">
                        <FileText className="h-5 w-5" /> REGISTRO DE CAPACITACIÓN
                    </CardTitle>
                    <Link href="/agenda-capacitacion" className="text-[10px] font-black uppercase bg-white/10 px-4 py-2 rounded-full hover:bg-white/20 transition-all">Cerrar</Link>
                </div>
            </CardHeader>
            <CardContent className="space-y-10 p-10">
              
              <div className="bg-primary/5 p-8 rounded-3xl border-2 border-dashed border-primary/10">
                  <Label className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2 mb-4">1. VINCULAR ACTIVIDAD ASIGNADA</Label>
                  <Popover open={open} onOpenChange={setOpen}>
                      <PopoverTrigger asChild>
                          <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between h-16 font-black text-xs uppercase border-2 rounded-2xl shadow-sm">
                          {selectedActivityKey ? linkedActivities.find((act) => act.id === selectedActivityKey)?.label : "Seleccionar actividad de la agenda..."}
                          <ChevronsUpDown className="ml-2 h-5 w-5 opacity-30 shrink-0" />
                          </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 shadow-2xl rounded-2xl overflow-hidden border-none">
                          <Command>
                              <CommandInput placeholder="Buscar por local o divulgador..." className="h-12" />
                              <CommandList>
                                  <CommandEmpty className="py-10 text-center text-[10px] font-black uppercase text-muted-foreground">No hay actividades pendientes para usted.</CommandEmpty>
                                  <CommandGroup>
                                  {linkedActivities.map((act) => (
                                      <CommandItem key={act.id} value={act.label} onSelect={() => { setSelectedActivityKey(act.id); setOpen(false);}} className="font-bold py-4 border-b last:border-0 cursor-pointer">
                                      {act.label}
                                      <Check className={cn("ml-auto h-4 w-4", selectedActivityKey === act.id ? "opacity-100" : "opacity-0")} />
                                      </CommandItem>
                                  ))}
                                  </CommandGroup>
                              </CommandList>
                          </Command>
                      </PopoverContent>
                  </Popover>
              </div>

              {selectedEntry && (
                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="grid md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black text-muted-foreground uppercase">Nombre del Divulgador</Label>
                            <div className="flex items-center gap-3 h-14 border-2 rounded-xl px-5 bg-muted/20">
                                <User className="h-4 w-4 text-primary opacity-40" />
                                <p className="font-black text-sm uppercase text-primary">{selectedEntry.divulgador.nombre}</p>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black text-muted-foreground uppercase">Fecha del Evento</Label>
                            <div className="flex items-center gap-3 h-14 border-2 rounded-xl px-5 bg-muted/20">
                                <Calendar className="h-4 w-4 text-primary opacity-40" />
                                <p className="font-black text-sm uppercase text-primary">{formatDateToDDMMYYYY(selectedEntry.activityData.fecha)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <Label className="text-[10px] font-black text-primary uppercase tracking-[0.2em] text-center block">2. CIUDADANOS CAPACITADOS (POR GÉNERO)</Label>
                        <div className="grid grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase text-muted-foreground text-center block">Masculino</Label>
                                <Input name="masculinos" type="number" min="0" defaultValue="0" className="h-14 text-center font-black text-2xl border-2 rounded-2xl" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase text-muted-foreground text-center block">Femenino</Label>
                                <Input name="femeninos" type="number" min="0" defaultValue="0" className="h-14 text-center font-black text-2xl border-2 rounded-2xl" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase text-muted-foreground text-center block">Otros</Label>
                                <Input name="otros" type="number" min="0" defaultValue="0" className="h-14 text-center font-black text-2xl border-2 rounded-2xl" />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[10px] font-black text-muted-foreground uppercase">3. Observaciones del Informe</Label>
                        <Input name="observaciones" placeholder="Detalles relevantes de la jornada..." className="h-14 font-bold border-2 rounded-xl uppercase text-xs" />
                    </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="bg-muted/30 border-t p-8">
              <Button type="submit" className="w-full h-16 font-black uppercase text-lg tracking-[0.2em] shadow-xl" disabled={isSubmitting || !selectedActivityKey}>
                {isSubmitting ? <Loader2 className="animate-spin mr-3 h-6 w-6" /> : "ENVIAR ANEXO III"}
              </Button>
            </CardFooter>
          </Card>
        </form>
      </main>
    </div>
  );
}

export default function InformeDivulgadorPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>}>
      <InformeContent />
    </Suspense>
  );
}
