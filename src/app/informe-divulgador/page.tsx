
"use client";

import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/header';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useFirebase, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, setDoc, query, where } from 'firebase/firestore';
import { type SolicitudCapacitacion, type InformeDivulgador } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileText, ChevronsUpDown, Check, Calendar, User, X, Camera, Trash2, MapPin, Clock, Building2, Landmark, ImageIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import Link from 'next/link';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import Image from 'next/image';

// Utility local para formato DD/MM/AAAA
const formatToOfficialDate = (dateStr: string | undefined) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
};

function InformeContent() {
  const { firestore } = useFirebase();
  const { user, isUserLoading, isProfileLoading } = useUser();
  const userProfile = user?.profile;
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const solicitudIdFromUrl = searchParams.get('solicitudId');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedActivityKey, setSelectedActivityKey] = useState<string | undefined>(undefined);
  
  const [markedCells, setMarkedCells] = useState<Set<number>>(new Set());

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const informesQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'informes-divulgador') : null), [firestore]);
  const { data: submittedInformes } = useCollection<InformeDivulgador>(informesQuery);

  const solicitudesQuery = useMemoFirebase(() => {
    if (!firestore || isProfileLoading || !userProfile) return null;
    const colRef = collection(firestore, 'solicitudes-capacitacion');
    
    const role = userProfile.role;
    const permissions = userProfile.permissions || [];
    const isAdminGlobal = role === 'admin' || role === 'director' || permissions.includes('admin_filter');

    if (isAdminGlobal) return colRef;
    if (permissions.includes('department_filter') && userProfile.departamento) {
        return query(colRef, where('departamento', '==', userProfile.departamento));
    }
    if (role === 'jefe' || permissions.includes('district_filter')) {
        return query(colRef, where('departamento', '==', userProfile.departamento), where('distrito', '==', userProfile.distrito));
    }
    return colRef; 
  }, [firestore, isProfileLoading, userProfile]);

  const { data: rawSolicitudes, isLoading: isLoadingSolicitudes } = useCollection<SolicitudCapacitacion>(solicitudesQuery);

  const linkedActivities = useMemo(() => {
    if (!rawSolicitudes || !userProfile || !user) return [];
    
    const submittedReportKeys = new Set(submittedInformes?.map(inf => `${inf.solicitud_id}_${inf.divulgador_id}`) || []);
    const isManager = ['admin', 'director', 'jefe'].includes(userProfile.role || '') || userProfile.permissions?.includes('admin_filter');

    return rawSolicitudes.flatMap(act => {
      if (act.cancelada) return [];
      const divulgadores = act.asignados || act.divulgadores || [];
      return divulgadores
        .filter(div => {
          if (isManager) return true;
          return div.id === user.uid;
        })
        .filter(div => !submittedReportKeys.has(`${act.id}_${div.id}`))
        .map(div => ({
          id: `${act.id}-${div.id}`,
          solicitudId: act.id,
          divulgador: div,
          activityData: act,
          label: `${formatToOfficialDate(act.fecha)} | ${act.lugar_local.toUpperCase()} | ${div.nombre.toUpperCase()}`
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

  const toggleCell = (num: number) => {
    setMarkedCells(prev => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num);
      else next.add(num);
      return next;
    });
  };

  const startCamera = async () => {
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', aspectRatio: { ideal: 0.75 } } 
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; }
    } catch (err) {
      toast({ variant: "destructive", title: "Error de Cámara" });
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  const takePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        setPhoto(canvas.toDataURL('image/jpeg', 0.7));
        stopCamera();
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPhoto(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firestore || !user || !selectedEntry) {
      toast({ variant: 'destructive', title: 'Error', description: 'Seleccione una actividad válida.' });
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData(event.currentTarget);

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
      total_personas: markedCells.size,
      marcaciones: Array.from(markedCells),
      observaciones: (formData.get('observaciones') as string || '').toUpperCase(),
      foto_respaldo_documental: photo || '',
      fecha_creacion: new Date().toISOString(),
      usuario_id: user.uid
    };

    try {
      const docId = `${selectedEntry.solicitudId}_${selectedEntry.divulgador.id}`;
      await setDoc(doc(firestore, 'informes-divulgador', docId), informeData);
      toast({ title: '¡Informe Guardado con Éxito!' });
      setSelectedActivityKey(undefined);
      setMarkedCells(new Set());
      setPhoto(null);
      event.currentTarget.reset();
    } catch (error) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'informes-divulgador', operation: 'create' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isUserLoading || isProfileLoading || isLoadingSolicitudes) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      <Header title="Anexo III - Informe Individual" />
      <main className="flex-1 p-2 md:p-6 flex flex-col items-center">
        
        <div className="w-full max-w-2xl mb-4 space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-black text-primary uppercase leading-tight tracking-tight">Informe Individual</h1>
                    <p className="text-[8px] font-bold text-muted-foreground uppercase flex items-center gap-1 mt-0.5 tracking-widest">
                        <FileText className="h-3 w-3" /> Anexo III
                    </p>
                </div>
                <Link href="/agenda-capacitacion">
                    <Button variant="outline" className="rounded-full border-2 font-black uppercase text-[8px] gap-1 h-8 shadow-sm">
                        <X className="h-3 w-3" /> Cancelar
                    </Button>
                </Link>
            </div>

            <Card className="border-primary/20 shadow-sm">
                <CardHeader className="py-2 px-4 bg-primary/5">
                    <CardTitle className="text-[8px] font-black flex items-center gap-2 uppercase tracking-widest text-primary">
                        VINCULAR ACTIVIDAD ASIGNADA
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                    <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between h-10 font-black text-[10px] uppercase border-2 rounded-lg shadow-sm">
                            <span className="truncate">{selectedActivityKey ? linkedActivities.find((act) => act.id === selectedActivityKey)?.label : "Seleccionar actividad..."}</span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-30 shrink-0" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0 shadow-2xl rounded-lg border-none overflow-hidden">
                            <Command>
                                <CommandInput placeholder="Buscar..." className="h-10 text-xs" />
                                <CommandList>
                                    <CommandEmpty className="py-6 text-center text-[9px] font-black uppercase text-muted-foreground">No hay actividades pendientes.</CommandEmpty>
                                    <CommandGroup>
                                    {linkedActivities.map((act) => (
                                        <CommandItem key={act.id} value={act.label} onSelect={() => { setSelectedActivityKey(act.id); setOpen(false);}} className="font-bold p-3 border-b last:border-0 cursor-pointer text-[10px]">
                                        {act.label}
                                        <Check className={cn("ml-auto h-3 w-3", selectedActivityKey === act.id ? "opacity-100" : "opacity-0")} />
                                        </CommandItem>
                                    ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </CardContent>
            </Card>
        </div>

        {selectedEntry && (
          <form onSubmit={handleSubmit} className="w-full max-w-2xl animate-in fade-in duration-500 pb-10">
            <Card className="shadow-xl border-none rounded-[1.5rem] overflow-hidden bg-white">
              <CardHeader className="bg-white border-b p-4 md:p-6">
                <div className="flex items-center gap-4">
                    <Image src="/logo.png" alt="Logo" width={40} height={40} className="object-contain shrink-0" />
                    <div>
                        <h2 className="text-base font-black uppercase text-[#1A1A1A] leading-tight">ANEXO III</h2>
                        <h3 className="text-[10px] font-black uppercase text-muted-foreground tracking-tight">INFORME DEL DIVULGADOR</h3>
                    </div>
                </div>
              </CardHeader>

              <CardContent className="p-4 md:p-6 space-y-6">
                
                <div className="grid grid-cols-1 gap-3 border-2 border-black rounded-xl overflow-hidden bg-[#F8F9FA]/50">
                    <div className="p-3 border-b-2 border-black bg-white">
                        <Label className="text-[8px] font-black uppercase text-muted-foreground tracking-widest block mb-1">LUGAR DE DIVULGACIÓN:</Label>
                        <p className="font-black text-sm uppercase">{selectedEntry.activityData.lugar_local}</p>
                    </div>
                    <div className="grid grid-cols-2">
                        <div className="p-3 border-r-2 border-black bg-white">
                            <Label className="text-[8px] font-black uppercase text-muted-foreground tracking-widest block mb-1">FECHA:</Label>
                            <p className="font-black text-sm uppercase">{formatToOfficialDate(selectedEntry.activityData.fecha)}</p>
                        </div>
                        <div className="p-3 bg-white">
                            <Label className="text-[8px] font-black uppercase text-muted-foreground tracking-widest block mb-1">HORARIO:</Label>
                            <p className="font-black text-sm uppercase">{selectedEntry.activityData.hora_desde} A {selectedEntry.activityData.hora_hasta} HS.</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3 border-2 border-black rounded-xl overflow-hidden bg-[#F8F9FA]/50">
                    <div className="p-3 border-b-2 border-black bg-white">
                        <Label className="text-[8px] font-black uppercase text-muted-foreground tracking-widest block mb-1">NOMBRE COMPLETO DIVULGADOR:</Label>
                        <p className="font-black text-sm uppercase">{selectedEntry.divulgador.nombre}</p>
                    </div>
                    <div className="grid grid-cols-2">
                        <div className="p-3 border-r-2 border-black bg-white">
                            <Label className="text-[8px] font-black uppercase text-muted-foreground tracking-widest block mb-1">C.I.C. N.º:</Label>
                            <p className="font-black text-sm uppercase">{selectedEntry.divulgador.cedula}</p>
                        </div>
                        <div className="p-3 bg-white">
                            <Label className="text-[8px] font-black uppercase text-muted-foreground tracking-widest block mb-1">VÍNCULO:</Label>
                            <p className="font-black text-sm uppercase">{selectedEntry.divulgador.vinculo}</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 border-2 border-black rounded-xl overflow-hidden bg-white">
                    <div className="p-3 border-r-2 border-black">
                        <Label className="text-[8px] font-black uppercase text-muted-foreground tracking-widest block mb-1">OFICINA:</Label>
                        <p className="font-black text-sm uppercase">{selectedEntry.activityData.distrito}</p>
                    </div>
                    <div className="p-3">
                        <Label className="text-[8px] font-black uppercase text-muted-foreground tracking-widest block mb-1">DEPARTAMENTO:</Label>
                        <p className="font-black text-sm uppercase">{selectedEntry.activityData.departamento}</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="bg-black text-white p-2 rounded-lg text-center">
                        <h4 className="font-black uppercase text-[9px] tracking-widest">MARCACIÓN CIUDADANA (X)</h4>
                    </div>
                    
                    <div className="grid grid-cols-8 sm:grid-cols-13 border border-black rounded-lg overflow-hidden bg-[#F8F9FA]">
                        {Array.from({ length: 104 }, (_, i) => i + 1).map((num) => (
                            <div 
                                key={num} 
                                className={cn(
                                    "aspect-square flex flex-col items-center justify-center border border-black/10 cursor-pointer transition-all hover:bg-black/5 select-none",
                                    markedCells.has(num) ? "bg-white shadow-inner" : "bg-transparent"
                                )}
                                onClick={() => toggleCell(num)}
                            >
                                <span className="text-[6px] font-bold text-muted-foreground leading-none mb-0.5">{num}</span>
                                {markedCells.has(num) && (
                                    <span className="text-base font-black leading-none animate-in zoom-in-50 duration-200">X</span>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="flex items-center justify-center gap-3 py-4 border-y border-dashed border-black/10">
                        <span className="text-xs font-black uppercase tracking-tight text-muted-foreground">TOTAL CAPACITADOS:</span>
                        <div className="h-10 w-20 border-b-2 border-black flex items-center justify-center">
                            <span className="text-2xl font-black">{markedCells.size}</span>
                        </div>
                    </div>
                </div>

                <div className="space-y-4 pt-2 border-t border-dashed">
                    <div className="flex items-center gap-2">
                        <Camera className="h-4 w-4 text-primary" />
                        <Label className="font-black uppercase text-[10px]">Respaldo Documental *</Label>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {photo ? (
                            <div className="relative aspect-video rounded-xl overflow-hidden border-2 border-muted shadow-lg group">
                                <Image src={photo} alt="Respaldo" fill className="object-cover" />
                                <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setPhoto(null)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-3">
                                <div 
                                    className="flex flex-col items-center justify-center h-24 border-2 border-dashed rounded-xl cursor-pointer hover:bg-muted/50 transition-all bg-white"
                                    onClick={startCamera}
                                >
                                    <Camera className="h-6 w-6 text-muted-foreground mb-1" />
                                    <span className="font-black uppercase text-[8px] text-muted-foreground">CÁMARA</span>
                                </div>
                                <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed rounded-xl cursor-pointer hover:bg-muted transition-all bg-white text-muted-foreground">
                                    <ImageIcon className="h-6 w-6 mb-1" />
                                    <span className="text-[8px] font-black uppercase">GALERÍA / PDF</span>
                                    <Input type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileUpload} />
                                </label>
                            </div>
                        )}
                        <div className="flex flex-col justify-center p-4 bg-muted/20 rounded-xl border border-dashed text-center">
                            <p className="text-[8px] font-bold text-muted-foreground uppercase leading-tight italic">
                                Adjunte foto del Anexo III físico con firma y sello oficial.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">Observaciones</Label>
                    <Input name="observations" placeholder="Opcional..." className="h-10 font-bold border-2 rounded-lg uppercase text-[10px] px-4" />
                </div>

              </CardContent>

              <CardFooter className="bg-muted/10 border-t p-4">
                <Button type="submit" className="w-full h-14 font-black uppercase text-sm tracking-widest shadow-lg bg-black hover:bg-black/90" disabled={isSubmitting || !photo || markedCells.size === 0}>
                  {isSubmitting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : "ENVIAR INFORME"}
                </Button>
              </CardFooter>
            </Card>
          </form>
        )}

        {!selectedEntry && (
            <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-[2rem] bg-white text-muted-foreground opacity-30 max-w-md w-full">
                <FileText className="h-12 w-12 mb-4" />
                <p className="text-xs font-black uppercase tracking-widest text-center px-6">Seleccione una actividad para comenzar</p>
            </div>
        )}
      </main>

      <Dialog open={isCameraOpen} onOpenChange={(open) => !open && stopCamera()}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden border-none bg-black rounded-xl">
          <div className="relative aspect-[3/4] bg-black">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-4 px-4">
              <Button 
                variant="outline" 
                size="icon" 
                onClick={stopCamera}
                className="rounded-full h-12 w-12 bg-white/10 border-white/20 text-white"
              >
                <X className="h-5 w-5" />
              </Button>
              <Button 
                size="lg" 
                onClick={takePhoto}
                className="rounded-full h-14 w-14 bg-white hover:bg-white/90 text-black border-4 border-black/20"
              >
                <Camera className="h-6 w-6" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AnexoIII() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>}>
      <InformeContent />
    </Suspense>
  );
}
