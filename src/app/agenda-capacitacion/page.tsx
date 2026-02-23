
"use client";

import { useState, useMemo } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription as CardDescriptionUI } from '@/components/ui/card';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { useUser, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, where, doc, updateDoc } from 'firebase/firestore';
import { type SolicitudCapacitacion, type Dato } from '@/lib/data';
import { Loader2, Calendar, MapPin, ClipboardCheck, LayoutList, Building2, UserPlus, CheckCircle2, QrCode, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { formatDateToDDMMYYYY } from '@/lib/utils';

export default function AgendaCapacitacionPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [selectedSolicitud, setSelectedSolicitud] = useState<SolicitudCapacitacion | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [qrSolicitud, setQrSolicitud] = useState<SolicitudCapacitacion | null>(null);

  // Master list of departments and districts
  const datosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'datos') : null, [firestore]);
  const { data: datosData, isLoading: isLoadingDatos } = useCollection<Dato>(datosQuery);

  // User list for assignment
  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !user?.profile) return null;
    const canFilterAll = user.profile.role === 'admin' || user.profile.permissions?.includes('admin_filter');
    if (canFilterAll) return collection(firestore, 'users');
    return query(collection(firestore, 'users'), where('distrito', '==', user.profile.distrito || ''));
  }, [firestore, user]);
  
  const { data: staffUsers } = useCollection(usersQuery);

  const solicitudesQuery = useMemoFirebase(() => {
    if (!firestore || !user?.profile) return null;
    const colRef = collection(firestore, 'solicitudes-capacitacion');
    const canViewAll = user.profile.role === 'admin' || user.profile.permissions?.includes('admin_filter');
    if (canViewAll) return query(colRef, orderBy('fecha', 'asc'));
    return query(colRef, where('departamento', '==', user.profile.departamento), where('distrito', '==', user.profile.distrito), orderBy('fecha', 'asc'));
  }, [firestore, user]);

  const { data: solicitudes, isLoading: isLoadingSolicitudes } = useCollection<SolicitudCapacitacion>(solicitudesQuery);

  const structuredAgenda = useMemo(() => {
    if (!datosData || !solicitudes) return [];
    const deptsMap: Map<string, { code: string, name: string, districts: Map<string, SolicitudCapacitacion[]> }> = new Map();
    datosData.forEach(d => {
      if (!deptsMap.has(d.departamento)) {
        deptsMap.set(d.departamento, { code: d.departamento_codigo || '00', name: d.departamento, districts: new Map() });
      }
    });
    solicitudes.forEach(s => {
      const dept = deptsMap.get(s.departamento);
      if (dept) {
        if (!dept.districts.has(s.distrito)) dept.districts.set(s.distrito, []);
        dept.districts.get(s.distrito)!.push(s);
      }
    });
    return Array.from(deptsMap.values()).filter(d => d.districts.size > 0).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  }, [datosData, solicitudes]);

  const handleAssignDivulgador = async (userId: string) => {
    if (!firestore || !selectedSolicitud) return;
    const selectedUser = staffUsers?.find(u => u.id === userId);
    if (!selectedUser) return;
    setIsAssigning(true);
    try {
      await updateDoc(doc(firestore, 'solicitudes-capacitacion', selectedSolicitud.id), {
        divulgador_id: selectedUser.id,
        divulgador_nombre: selectedUser.username,
        divulgador_cedula: selectedUser.cedula || '',
        divulgador_vinculo: selectedUser.vinculo || ''
      });
      toast({ title: "¡Divulgador Asignado!", description: `${selectedUser.username} ha sido asignado.` });
      setSelectedSolicitud(null);
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo realizar la asignación." });
    } finally {
      setIsAssigning(false);
    }
  };

  const getEncuestaUrl = (id: string) => {
      if (typeof window === 'undefined') return '';
      return `${window.location.origin}/encuesta-satisfaccion?solicitudId=${id}`;
  }

  const canAssign = user?.profile?.role === 'admin' || user?.profile?.permissions?.includes('assign_staff');

  if (isUserLoading || isLoadingSolicitudes || isLoadingDatos) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/10">
      <Header title="Agenda Consolidada - CIDEE" />
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 bg-white p-6 rounded-lg border shadow-sm">
          <div>
            <h1 className="text-3xl font-black tracking-tight uppercase text-primary">Agenda de Capacitaciones</h1>
            <p className="text-muted-foreground flex items-center gap-2 mt-1">
              <LayoutList className="h-4 w-4" />
              Gestión nacional de actividades y asignaciones.
            </p>
          </div>
        </div>

        {structuredAgenda.length === 0 ? (
          <Card className="p-12 text-center border-dashed">
            <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-muted-foreground">No hay actividades agendadas.</p>
          </Card>
        ) : (
          <div className="space-y-6">
            <Accordion type="multiple" className="w-full space-y-4">
              {structuredAgenda.map((dept) => (
                <AccordionItem key={dept.name} value={dept.name} className="border bg-white rounded-lg overflow-hidden shadow-sm">
                  <AccordionTrigger className="hover:no-underline px-6 py-5 bg-muted/10">
                    <div className="flex items-center gap-4 text-left">
                      <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black border border-primary/20">{dept.code}</div>
                      <div>
                        <h2 className="text-xl font-bold uppercase tracking-tight">{dept.name}</h2>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">{Array.from(dept.districts.values()).flat().length} ACTIVIDADES</span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-0">
                    <div className="divide-y border-t bg-muted/5">
                      {Array.from(dept.districts.entries()).map(([dist, items]) => (
                        <div key={dist} className="p-6">
                          <div className="flex items-center gap-2 mb-4">
                            <Building2 className="h-5 w-5 text-primary" />
                            <h3 className="text-lg font-black uppercase text-foreground/80">{dist}</h3>
                          </div>
                          <div className="grid grid-cols-1 gap-4">
                            {items.map((item) => (
                              <div key={item.id} className="group relative border rounded-md p-4 hover:border-primary transition-all bg-white">
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                                  <div className="lg:col-span-3">
                                    <p className="text-[10px] font-bold text-primary uppercase">Solicitante</p>
                                    <p className="font-black text-sm uppercase leading-tight">{item.nombre_completo}</p>
                                    <Badge variant="outline" className="mt-2 text-[9px] uppercase font-bold">{item.tipo_solicitud}</Badge>
                                  </div>
                                  <div className="lg:col-span-3 flex flex-col gap-1">
                                    <div className="flex items-start gap-2">
                                      <MapPin className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                                      <p className="text-xs font-bold uppercase">{item.lugar_local}</p>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                      <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
                                      <p className="text-[10px] font-bold uppercase">{formatDateToDDMMYYYY(item.fecha)} | {item.hora_desde} HS</p>
                                    </div>
                                  </div>
                                  <div className="lg:col-span-3">
                                    <div className="p-2 rounded bg-muted/30 border border-dashed">
                                        <p className="text-[10px] font-black text-muted-foreground uppercase mb-1">Divulgador</p>
                                        <p className="text-xs font-black uppercase text-primary">{item.divulgador_nombre || 'Pendiente'}</p>
                                    </div>
                                  </div>
                                  <div className="lg:col-span-3 flex justify-end gap-2">
                                    <Button variant="outline" size="sm" className="h-8 text-[10px] font-black uppercase" onClick={() => setQrSolicitud(item)}>
                                        <QrCode className="mr-1 h-3 w-3" /> QR Encuesta
                                    </Button>
                                    {canAssign && (
                                        <Button variant="outline" size="sm" className="h-8 text-[10px] font-black uppercase" onClick={() => setSelectedSolicitud(item)}>
                                            <UserPlus className="mr-1 h-3 w-3" /> Asignar
                                        </Button>
                                    )}
                                    <Link href={`/informe-divulgador?solicitudId=${item.id}`}>
                                      <Button variant="default" size="sm" className="h-8 text-[10px] font-black uppercase">Informe</Button>
                                    </Link>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        )}
      </main>

      <Dialog open={!!qrSolicitud} onOpenChange={(o) => !o && setQrSolicitud(null)}>
          <DialogContent className="max-w-xs text-center p-8">
              <DialogHeader>
                  <DialogTitle className="uppercase font-black">QR Encuesta Ciudadana</DialogTitle>
                  <DialogDescription className="text-[10px] font-bold uppercase">Escanea para evaluar la sesión en {qrSolicitud?.lugar_local}</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center justify-center space-y-6 pt-4">
                  <div className="p-4 bg-white border-4 border-primary rounded-2xl shadow-xl">
                      {/* Generador de QR simple usando API de Google Charts para rapidez */}
                      <img 
                        src={`https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${encodeURIComponent(getEncuestaUrl(qrSolicitud?.id || ''))}&choe=UTF-8`} 
                        alt="QR Encuesta" 
                        className="w-48 h-48"
                      />
                  </div>
                  <div className="space-y-2 w-full">
                      <p className="text-[9px] font-bold text-muted-foreground uppercase">Link Directo:</p>
                      <code className="text-[8px] bg-muted p-2 rounded block break-all font-mono border">
                          {getEncuestaUrl(qrSolicitud?.id || '')}
                      </code>
                  </div>
                  <Button variant="ghost" className="w-full text-[10px] font-black" onClick={() => setQrSolicitud(null)}>CERRAR</Button>
              </div>
          </DialogContent>
      </Dialog>

      <Dialog open={!!selectedSolicitud} onOpenChange={(o) => !o && setSelectedSolicitud(null)}>
          <DialogContent>
              <DialogHeader><DialogTitle className="uppercase font-black">Asignar Personal</DialogTitle></DialogHeader>
              <div className="py-4">
                  <Select onValueChange={handleAssignDivulgador} disabled={isAssigning}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                      <SelectContent>
                          {staffUsers?.map(u => <SelectItem key={u.id} value={u.id}>{u.username} ({u.role})</SelectItem>)}
                      </SelectContent>
                  </Select>
              </div>
          </DialogContent>
      </Dialog>
    </div>
  );
}
