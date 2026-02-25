"use client";

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MessageSquareHeart, CheckCircle2, FileDown, Globe, MapPin, Calendar, Clock, DatabaseZap, Search, X, Check } from 'lucide-react';
import { useUser, useFirebase, useMemoFirebase, useDoc, useCollection } from '@/firebase';
import { collection, addDoc, serverTimestamp, doc, query, where } from 'firebase/firestore';
import { Separator } from '@/components/ui/separator';
import jsPDF from 'jspdf';
import { type SolicitudCapacitacion } from '@/lib/data';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn, formatDateToDDMMYYYY } from '@/lib/utils';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function EncuestaContent() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  
  const [isMounted, setIsMounted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [internalSolicitudId, setInternalSolicitudId] = useState<string | null>(null);
  
  const solicitudIdFromUrl = searchParams.get('solicitudId');
  const effectiveSolicitudId = solicitudIdFromUrl || internalSolicitudId;

  const [formData, setFormData] = useState({
    lugar_practica: '',
    fecha: '',
    hora: '',
    edad: '',
    genero: 'hombre' as 'hombre' | 'mujer',
    pueblo_originario: false,
    utilidad_maquina: 'muy_util' as const,
    facilidad_maquina: 'muy_facil' as const,
    seguridad_maquina: 'muy_seguro' as const,
    departamento: '',
    distrito: '',
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const solicitudRef = useMemoFirebase(() => 
    firestore && effectiveSolicitudId ? doc(firestore, 'solicitudes-capacitacion', effectiveSolicitudId) : null,
    [firestore, effectiveSolicitudId]
  );
  
  const { data: linkedSolicitud } = useDoc<SolicitudCapacitacion>(solicitudRef);

  const agendaQuery = useMemoFirebase(() => {
    if (!firestore || !user?.profile) return null;
    const profile = user.profile;
    const colRef = collection(firestore, 'solicitudes-capacitacion');
    
    const hasAdminFilter = ['admin', 'director'].includes(profile.role || '') || profile.permissions?.includes('admin_filter');
    const hasDeptFilter = !hasAdminFilter && profile.permissions?.includes('department_filter');
    const hasDistFilter = !hasAdminFilter && !hasDeptFilter && (profile.permissions?.includes('district_filter') || profile.role === 'jefe' || profile.role === 'funcionario');

    if (hasAdminFilter) return colRef;
    if (hasDeptFilter && profile.departamento) return query(colRef, where('departamento', '==', profile.departamento));
    if (hasDistFilter && profile.departamento && profile.distrito) {
        return query(colRef, where('departamento', '==', profile.departamento), where('distrito', '==', profile.distrito));
    }
    return null;
  }, [firestore, user, isUserLoading]);

  const { data: agendaItems } = useCollection<SolicitudCapacitacion>(agendaQuery);

  useEffect(() => {
    if (linkedSolicitud) {
      setFormData(prev => ({
        ...prev,
        lugar_practica: linkedSolicitud.lugar_local || '',
        fecha: linkedSolicitud.fecha || '',
        hora: linkedSolicitud.hora_desde || '',
        departamento: linkedSolicitud.departamento || '',
        distrito: linkedSolicitud.distrito || '',
      }));
    } else if (!effectiveSolicitudId && user?.profile) {
        setFormData(prev => ({
            ...prev,
            departamento: user.profile?.departamento || prev.departamento,
            distrito: user.profile?.distrito || prev.distrito,
        }));
    }
  }, [linkedSolicitud, effectiveSolicitudId, user]);

  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const response = await fetch('/logo.png');
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => setLogoBase64(reader.result as string);
        reader.readAsDataURL(blob);
      } catch (error) {
        console.error("Error fetching logo:", error);
      }
    };
    fetchLogo();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleValueChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = () => {
    if (!firestore) return;
    if (!formData.lugar_practica || !formData.fecha || !formData.edad) {
        toast({ variant: "destructive", title: "Faltan datos" });
        return;
    }

    setIsSubmitting(true);
    const encuestaData = {
      ...formData,
      solicitud_id: effectiveSolicitudId || 'CARGA_MANUAL_OFICINA',
      usuario_id: user?.uid || 'CIUDADANO_EXTERNO',
      fecha_creacion: new Date().toISOString(),
      server_timestamp: serverTimestamp(),
    };

    addDoc(collection(firestore, 'encuestas-satisfaccion'), encuestaData)
      .then(() => {
        toast({ title: "¡Gracias!", description: "Feedback registrado." });
        setFormData(p => ({ 
          ...p, 
          edad: '', 
          utilidad_maquina: 'muy_util',
          facilidad_maquina: 'muy_facil',
          seguridad_maquina: 'muy_seguro',
        }));
        setIsSubmitting(false);
      })
      .catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: 'encuestas-satisfaccion',
          operation: 'create',
          requestResourceData: encuestaData
        }));
        setIsSubmitting(false);
      });
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();

    if (logoBase64) doc.addImage(logoBase64, 'PNG', margin, 5, 22, 22);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text("ANEXO II - Encuesta de Satisfacción", pageWidth / 2, 15, { align: "center" });
    doc.text("Práctica con la Máquina de Votación", pageWidth / 2, 22, { align: "center" });

    let y = 40;
    doc.setDrawColor(0);
    doc.setLineWidth(0.2);
    doc.rect(margin, y, pageWidth - (margin * 2), 25);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`LUGAR DONDE REALIZÓ LA PRÁCTICA: ${formData.lugar_practica.toUpperCase()}`, margin + 5, y + 8);
    
    const dateObj = new Date(formData.fecha || new Date());
    doc.text(`FECHA: ${dateObj.getDate()} / ${dateObj.getMonth() + 1} / 2026`, margin + 5, y + 16);
    doc.text(`HORA: ${formData.hora}`, margin + 80, y + 16);
    doc.text(`EDAD: ${formData.edad} AÑOS`, margin + 5, y + 22);
    
    doc.text(`GÉNERO: HOMBRE`, margin + 40, y + 22);
    doc.rect(margin + 75, y + 18, 5, 5);
    if(formData.genero === 'hombre') doc.text("X", margin + 76, y + 22);
    
    doc.text(`MUJER`, margin + 85, y + 22);
    doc.rect(margin + 100, y + 18, 5, 5);
    if(formData.genero === 'mujer') doc.text("X", margin + 101, y + 22);

    doc.text(`PUEBLO ORIGINARIO`, margin + 115, y + 22);
    doc.rect(margin + 155, y + 18, 5, 5);
    if(formData.pueblo_originario) doc.text("X", margin + 156, y + 22);

    y += 35;
    const drawQuestion = (q: string, options: string[], selected: string, currentY: number) => {
        doc.setFont('helvetica', 'bold');
        doc.text(q, margin, currentY);
        let optY = currentY + 8;
        options.forEach(opt => {
            doc.setFont('helvetica', 'normal');
            doc.rect(margin, optY - 4, 5, 5);
            if (selected === opt.toLowerCase().replace(/ /g, '_')) {
                doc.text("X", margin + 1, optY - 0.5);
            }
            doc.text(opt, margin + 10, optY);
            optY += 8;
        });
        return optY + 5;
    };

    y = drawQuestion("¿Le parece útil practicar con la máquina de votación?", ["Muy útil", "Útil", "Poco útil", "Nada útil"], formData.utilidad_maquina, y);
    y = drawQuestion("¿Le resultó fácil usar la máquina de votación?", ["Muy fácil", "Fácil", "Poco fácil", "Nada fácil"], formData.facilidad_maquina, y);
    y = drawQuestion("Después de la práctica, ¿qué tan seguro/a se siente para utilizar la máquina de votación?", ["Muy seguro/a", "Seguro/a", "Poco seguro/a", "Nada seguro/a"], formData.seguridad_maquina, y);

    y = doc.internal.pageSize.getHeight() - 40;
    doc.rect(margin, y, pageWidth - (margin * 2), 20);
    doc.setFont('helvetica', 'bold');
    doc.text("PARA USO INTERNO DE LA JUSTICIA ELECTORAL", margin + 5, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(`Distrito: ${formData.distrito}`, margin + 5, y + 12);
    doc.text(`Departamento: ${formData.departamento}`, margin + 80, y + 12);
    doc.setFontSize(8);
    doc.text("Enviar a la Dirección del CIDEE hasta el martes posterior a la semana de divulgación.", margin + 5, y + 17);

    doc.save(`Encuesta-${formData.lugar_practica || 'Satisfaccion'}.pdf`);
  };

  if (!isMounted) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      {user ? <Header title="Oficina" /> : (
        <header className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-50">
            <div className="flex items-center gap-4">
                <Image src="/logo.png" alt="Logo" width={40} height={40} className="object-contain" />
                <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase text-primary leading-none">Justicia Electoral</span>
                    <span className="text-sm font-bold uppercase tracking-tight">Portal Ciudadano</span>
                </div>
            </div>
        </header>
      )}
      <main className="flex-1 p-4 md:p-8">
        
        {user && (
            <div className="mx-auto max-w-3xl mb-6 space-y-4">
                <Card className="border-primary/20 shadow-md">
                    <CardHeader className="py-4 bg-primary/5">
                        <CardTitle className="text-[10px] font-black flex items-center gap-2 uppercase tracking-widest text-primary">
                            <DatabaseZap className="h-4 w-4" /> CARGA INSTITUCIONAL (OFICINA)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="flex gap-2">
                            <Select onValueChange={setInternalSolicitudId} value={internalSolicitudId || undefined}>
                                <SelectTrigger className="h-11 font-bold">
                                    <SelectValue placeholder="Vincular actividad de agenda..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {agendaItems?.map(item => (
                                        <SelectItem key={item.id} value={item.id}>{formatDateToDDMMYYYY(item.fecha)} | {item.lugar_local}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {internalSolicitudId && <Button variant="ghost" size="icon" onClick={() => setInternalSolicitudId(null)}><X className="h-4 w-4" /></Button>}
                        </div>
                    </CardContent>
                </Card>
            </div>
        )}

        <Card className="mx-auto max-w-3xl shadow-2xl border-none rounded-[2.5rem] overflow-hidden bg-white">
          <CardHeader className="bg-white border-b p-10">
            <div className="flex items-center gap-6 mb-4">
                <Image src="/logo.png" alt="Logo" width={60} height={60} className="object-contain" />
                <div className="flex-1">
                    <CardTitle className="uppercase font-black text-primary text-xl">ANEXO II - Encuesta de Satisfacción</CardTitle>
                    <CardDescription className="font-bold text-sm uppercase">Práctica con la Máquina de Votación</CardDescription>
                </div>
            </div>
          </CardHeader>
          <CardContent className="p-10 space-y-12">
            
            {/* Box 1: Datos Iniciales */}
            <div className="p-8 border-2 border-black rounded-3xl space-y-8 bg-white shadow-sm">
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-primary tracking-widest">LUGAR DONDE REALIZÓ LA PRÁCTICA:</Label>
                    <Input 
                        name="lugar_practica" 
                        value={formData.lugar_practica} 
                        onChange={handleInputChange} 
                        readOnly={!!effectiveSolicitudId}
                        className="h-12 font-black text-lg border-x-0 border-t-0 border-b-2 rounded-none border-black focus-visible:ring-0 px-0 uppercase bg-transparent" 
                    />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-primary tracking-widest">FECHA:</Label>
                        <Input name="fecha" type="date" value={formData.fecha} onChange={handleInputChange} readOnly={!!effectiveSolicitudId} className="h-12 font-black text-lg border-x-0 border-t-0 border-b-2 rounded-none border-black focus-visible:ring-0 px-0 bg-transparent" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-primary tracking-widest">HORA:</Label>
                        <Input name="hora" type="time" value={formData.hora} onChange={handleInputChange} readOnly={!!effectiveSolicitudId} className="h-12 font-black text-lg border-x-0 border-t-0 border-b-2 rounded-none border-black focus-visible:ring-0 px-0 bg-transparent" />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-end">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-primary tracking-widest">EDAD (AÑOS):</Label>
                        <Input name="edad" type="number" value={formData.edad} onChange={handleInputChange} className="h-12 font-black text-lg border-x-0 border-t-0 border-b-2 rounded-none border-black focus-visible:ring-0 px-0 bg-transparent" />
                    </div>
                    <div className="md:col-span-2 flex flex-wrap gap-6 items-center">
                        <Label className="text-[10px] font-black uppercase text-primary tracking-widest shrink-0">GÉNERO:</Label>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center space-x-2 cursor-pointer" onClick={() => handleValueChange('genero', 'hombre')}>
                                <div className={cn("h-6 w-6 border-2 border-black rounded-md flex items-center justify-center transition-colors", formData.genero === 'hombre' ? "bg-black text-white" : "bg-white")}>
                                    {formData.genero === 'hombre' && <Check className="h-4 w-4 stroke-[4]" />}
                                </div>
                                <span className="font-black text-xs uppercase">HOMBRE</span>
                            </div>
                            <div className="flex items-center space-x-2 cursor-pointer" onClick={() => handleValueChange('genero', 'mujer')}>
                                <div className={cn("h-6 w-6 border-2 border-black rounded-md flex items-center justify-center transition-colors", formData.genero === 'mujer' ? "bg-black text-white" : "bg-white")}>
                                    {formData.genero === 'mujer' && <Check className="h-4 w-4 stroke-[4]" />}
                                </div>
                                <span className="font-black text-xs uppercase">MUJER</span>
                            </div>
                        </div>
                        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setFormData(p => ({...p, pueblo_originario: !p.pueblo_originario}))}>
                            <Label className="text-[10px] font-black uppercase text-primary tracking-widest cursor-pointer">PUEBLO ORIGINARIO:</Label>
                            <div className={cn("h-6 w-6 border-2 border-black rounded-md flex items-center justify-center transition-colors", formData.pueblo_originario ? "bg-black text-white" : "bg-white")}>
                                {formData.pueblo_originario && <Check className="h-4 w-4 stroke-[4]" />}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-12">
              <div className="space-y-6">
                <Label className="font-black text-base uppercase text-primary leading-tight">1. ¿Le parece útil practicar con la máquina de votación?</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {['muy_util', 'util', 'poco_util', 'nada_util'].map(val => (
                    <div key={val} className="flex items-center space-x-3 cursor-pointer" onClick={() => handleValueChange('utilidad_maquina', val as any)}>
                        <div className={cn("h-6 w-6 border-2 border-black rounded-md flex items-center justify-center transition-colors", formData.utilidad_maquina === val ? "bg-black text-white" : "bg-white")}>
                            {formData.utilidad_maquina === val && <Check className="h-4 w-4 stroke-[4]" />}
                        </div>
                        <Label className="font-black text-xs uppercase cursor-pointer">{val.replace('_', ' ')}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <Label className="font-black text-base uppercase text-primary leading-tight">2. ¿Le resultó fácil usar la máquina de votación?</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {['muy_facil', 'facil', 'poco_facil', 'nada_facil'].map(val => (
                    <div key={val} className="flex items-center space-x-3 cursor-pointer" onClick={() => handleValueChange('facilidad_maquina', val as any)}>
                        <div className={cn("h-6 w-6 border-2 border-black rounded-md flex items-center justify-center transition-colors", formData.facilidad_maquina === val ? "bg-black text-white" : "bg-white")}>
                            {formData.facilidad_maquina === val && <Check className="h-4 w-4 stroke-[4]" />}
                        </div>
                        <Label className="font-black text-xs uppercase cursor-pointer">{val.replace('_', ' ')}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <Label className="font-black text-base uppercase text-primary leading-tight">3. Después de la práctica, ¿qué tan seguro/a se siente para utilizar la máquina de votación?</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {['muy_seguro', 'seguro', 'poco_seguro', 'nada_seguro'].map(val => (
                    <div key={val} className="flex items-center space-x-3 cursor-pointer" onClick={() => handleValueChange('seguridad_maquina', val as any)}>
                        <div className={cn("h-6 w-6 border-2 border-black rounded-md flex items-center justify-center transition-colors", formData.seguridad_maquina === val ? "bg-black text-white" : "bg-white")}>
                            {formData.seguridad_maquina === val && <Check className="h-4 w-4 stroke-[4]" />}
                        </div>
                        <Label className="font-black text-xs uppercase cursor-pointer">{val.replace('_', ' ')}/A</Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Internal Use Box */}
            <div className="p-8 border-2 border-black rounded-xl space-y-4">
                <p className="text-[10px] font-black uppercase text-primary tracking-widest">PARA USO INTERNO DE LA JUSTICIA ELECTORAL</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <p className="text-xs font-bold uppercase">Distrito: <span className="text-primary font-black ml-2">{formData.distrito || '---'}</span></p>
                    <p className="text-xs font-bold uppercase">Departamento: <span className="text-primary font-black ml-2">{formData.departamento || '---'}</span></p>
                </div>
                <p className="text-[9px] font-bold text-muted-foreground uppercase">Enviar a la Dirección del CIDEE hasta el martes posterior a la semana de divulgación.</p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row gap-4 bg-muted/30 border-t p-10">
            {user && <Button onClick={generatePDF} variant="outline" className="h-16 px-8 border-2 border-primary text-primary font-black uppercase shadow-sm">PDF OFICIAL</Button>}
            <div className="flex-1" />
            <Button onClick={handleSubmit} disabled={isSubmitting || !formData.edad} className="px-16 h-16 font-black text-xl uppercase shadow-2xl bg-black hover:bg-black/90 text-white rounded-2xl">
              {isSubmitting ? <Loader2 className="animate-spin mr-3 h-7 w-7" /> : "ENVIAR ENCUESTA"}
            </Button>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}

export default function EncuestaSatisfaccionPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>}>
      <EncuestaContent />
    </Suspense>
  );
}
