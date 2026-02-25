
"use client";

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MessageSquareHeart, CheckCircle2, FileDown, DatabaseZap, Check } from 'lucide-react';
import { useUser, useFirebase, useMemoFirebase, useDoc, useCollection } from '@/firebase';
import { collection, addDoc, serverTimestamp, doc, query, where } from 'firebase/firestore';
import jsPDF from 'jspdf';
import { type SolicitudCapacitacion } from '@/lib/data';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn, formatDateToDDMMYYYY } from '@/lib/utils';
import Image from 'next/image';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function EncuestaContent() {
  const { user } = useUser();
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

  // Auto-completar desde Agenda (QR o Selector Interno)
  useEffect(() => {
    if (linkedSolicitud) {
      setFormData(prev => ({
        ...prev,
        lugar_practica: (linkedSolicitud.lugar_local || '').toUpperCase(),
        fecha: linkedSolicitud.fecha || '',
        hora: linkedSolicitud.hora_desde || '',
        departamento: linkedSolicitud.departamento || '',
        distrito: linkedSolicitud.distrito || '',
      }));
    }
  }, [linkedSolicitud]);

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
        toast({ variant: "destructive", title: "Faltan datos obligatorios" });
        return;
    }

    setIsSubmitting(true);
    const encuestaData = {
      ...formData,
      solicitud_id: effectiveSolicitudId || 'CARGA_MANUAL',
      usuario_id: user?.uid || 'CIUDADANO_EXTERNO',
      fecha_creacion: new Date().toISOString(),
      server_timestamp: serverTimestamp(),
    };

    addDoc(collection(firestore, 'encuestas-satisfaccion'), encuestaData)
      .then(() => {
        toast({ title: "¡Gracias por su participación!", description: "Su feedback ha sido registrado exitosamente." });
        if (!effectiveSolicitudId) {
            setFormData(p => ({ ...p, edad: '', lugar_practica: '', fecha: '', hora: '' }));
        } else {
            setFormData(p => ({ ...p, edad: '' }));
        }
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
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
    doc.text("ANEXO II - Encuesta de Satisfacción", pageWidth / 2, 15, { align: "center" });
    doc.text("Práctica con la Máquina de Votación", pageWidth / 2, 22, { align: "center" });
    doc.save(`Encuesta-${formData.lugar_practica || 'Satisfaccion'}.pdf`);
  };

  if (!isMounted) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      {!user && (
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
        <Card className="mx-auto max-w-3xl shadow-2xl border-none rounded-[2.5rem] overflow-hidden bg-white">
          <CardHeader className="bg-white border-b p-8 md:p-12">
            <div className="flex items-start gap-6">
                <Image src="/logo.png" alt="Logo TSJE" width={70} height={70} className="object-contain shrink-0" />
                <div className="space-y-1">
                    <h1 className="text-2xl md:text-3xl font-black uppercase text-[#1A1A1A] leading-tight">ANEXO II - ENCUESTA DE SATISFACCIÓN</h1>
                    <h2 className="text-lg font-black uppercase text-muted-foreground tracking-tight">PRÁCTICA CON LA MÁQUINA DE VOTACIÓN</h2>
                </div>
            </div>
          </CardHeader>

          <CardContent className="p-8 md:p-12 space-y-16">
            
            {/* Box 1: Lugar, Fecha, Hora (IDÉNTICO A LA IMAGEN) */}
            <div className="p-10 border-[3px] border-black rounded-[2.5rem] space-y-12 bg-white">
                <div className="space-y-2">
                    <Label className="text-[11px] font-black uppercase text-[#1A1A1A] tracking-[0.1em]">LUGAR DONDE REALIZÓ LA PRÁCTICA:</Label>
                    <Input 
                        name="lugar_practica" 
                        value={formData.lugar_practica} 
                        onChange={handleInputChange} 
                        readOnly={!!effectiveSolicitudId}
                        placeholder="__________________________________________________________"
                        className="h-14 font-black text-xl border-x-0 border-t-0 border-b-[3px] rounded-none border-black focus-visible:ring-0 px-0 uppercase bg-transparent placeholder:text-muted-foreground/20" 
                    />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="space-y-2">
                        <Label className="text-[11px] font-black uppercase text-[#1A1A1A] tracking-[0.1em]">FECHA:</Label>
                        <Input 
                            name="fecha" 
                            type={effectiveSolicitudId ? "text" : "date"}
                            value={effectiveSolicitudId ? formatDateToDDMMYYYY(formData.fecha) : formData.fecha} 
                            onChange={handleInputChange} 
                            readOnly={!!effectiveSolicitudId}
                            placeholder="dd/mm/aaaa"
                            className="h-14 font-black text-xl border-x-0 border-t-0 border-b-[3px] rounded-none border-black focus-visible:ring-0 px-0 bg-transparent placeholder:text-muted-foreground/20" 
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[11px] font-black uppercase text-[#1A1A1A] tracking-[0.1em]">HORA:</Label>
                        <Input 
                            name="hora" 
                            type={effectiveSolicitudId ? "text" : "time"}
                            value={formData.hora} 
                            onChange={handleInputChange} 
                            readOnly={!!effectiveSolicitudId}
                            placeholder="--:--"
                            className="h-14 font-black text-xl border-x-0 border-t-0 border-b-[3px] rounded-none border-black focus-visible:ring-0 px-0 bg-transparent placeholder:text-muted-foreground/20" 
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-12 items-end">
                    <div className="space-y-2">
                        <Label className="text-[11px] font-black uppercase text-[#1A1A1A] tracking-[0.1em]">EDAD (AÑOS):</Label>
                        <Input name="edad" type="number" value={formData.edad} onChange={handleInputChange} className="h-14 font-black text-xl border-x-0 border-t-0 border-b-[3px] rounded-none border-black focus-visible:ring-0 px-0 bg-transparent" />
                    </div>
                    <div className="md:col-span-2 flex flex-wrap gap-8 items-center">
                        <Label className="text-[11px] font-black uppercase text-[#1A1A1A] tracking-[0.1em] shrink-0">GÉNERO:</Label>
                        <div className="flex items-center gap-6">
                            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => handleValueChange('genero', 'hombre')}>
                                <div className={cn("h-7 w-7 border-[3px] border-black rounded-lg flex items-center justify-center transition-colors", formData.genero === 'hombre' ? "bg-black text-white" : "bg-white")}>
                                    {formData.genero === 'hombre' && <Check className="h-5 w-5 stroke-[4]" />}
                                </div>
                                <span className="font-black text-xs uppercase">HOMBRE</span>
                            </div>
                            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => handleValueChange('genero', 'mujer')}>
                                <div className={cn("h-7 w-7 border-[3px] border-black rounded-lg flex items-center justify-center transition-colors", formData.genero === 'mujer' ? "bg-black text-white" : "bg-white")}>
                                    {formData.genero === 'mujer' && <Check className="h-5 w-5 stroke-[4]" />}
                                </div>
                                <span className="font-black text-xs uppercase">MUJER</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-16">
              <div className="space-y-8">
                <Label className="font-black text-lg md:text-xl uppercase text-[#1A1A1A] leading-tight">1. ¿Le parece útil practicar con la máquina de votación?</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {['muy_util', 'util', 'poco_util', 'nada_util'].map(val => (
                    <div key={val} className="flex items-center space-x-4 cursor-pointer group" onClick={() => handleValueChange('utilidad_maquina', val as any)}>
                        <div className={cn("h-7 w-7 border-[3px] border-black rounded-lg flex items-center justify-center transition-all group-hover:scale-110", formData.utilidad_maquina === val ? "bg-black text-white" : "bg-white")}>
                            {formData.utilidad_maquina === val && <Check className="h-5 w-5 stroke-[4]" />}
                        </div>
                        <Label className="font-black text-xs uppercase cursor-pointer group-hover:text-primary transition-colors">{val.replace('_', ' ')}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-8">
                <Label className="font-black text-lg md:text-xl uppercase text-[#1A1A1A] leading-tight">2. ¿Le resultó fácil usar la máquina de votación?</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {['muy_facil', 'facil', 'poco_facil', 'nada_facil'].map(val => (
                    <div key={val} className="flex items-center space-x-4 cursor-pointer group" onClick={() => handleValueChange('facilidad_maquina', val as any)}>
                        <div className={cn("h-7 w-7 border-[3px] border-black rounded-lg flex items-center justify-center transition-all group-hover:scale-110", formData.facilidad_maquina === val ? "bg-black text-white" : "bg-white")}>
                            {formData.facilidad_maquina === val && <Check className="h-5 w-5 stroke-[4]" />}
                        </div>
                        <Label className="font-black text-xs uppercase cursor-pointer group-hover:text-primary transition-colors">{val.replace('_', ' ')}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-8">
                <Label className="font-black text-lg md:text-xl uppercase text-[#1A1A1A] leading-tight">3. Después de la práctica, ¿qué tan seguro/a se siente para utilizar la máquina de votación?</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {['muy_seguro', 'seguro', 'poco_seguro', 'nada_seguro'].map(val => (
                    <div key={val} className="flex items-center space-x-4 cursor-pointer group" onClick={() => handleValueChange('seguridad_maquina', val as any)}>
                        <div className={cn("h-7 w-7 border-[3px] border-black rounded-lg flex items-center justify-center transition-all group-hover:scale-110", formData.seguridad_maquina === val ? "bg-black text-white" : "bg-white")}>
                            {formData.seguridad_maquina === val && <Check className="h-5 w-5 stroke-[4]" />}
                        </div>
                        <Label className="font-black text-xs uppercase cursor-pointer group-hover:text-primary transition-colors">{val.replace('_', ' ')}/A</Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col sm:flex-row gap-6 bg-muted/30 border-t p-10 md:p-12">
            <Button onClick={handleSubmit} disabled={isSubmitting || !formData.edad} className="w-full h-20 font-black text-2xl uppercase shadow-2xl bg-black hover:bg-black/90 text-white rounded-[1.5rem] tracking-wider">
              {isSubmitting ? <Loader2 className="animate-spin mr-4 h-8 w-8" /> : "ENVIAR MI OPINIÓN"}
            </Button>
          </CardFooter>
        </Card>
        
        <div className="mt-8 text-center pb-12">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] opacity-40">Justicia Electoral - República del Paraguay</p>
        </div>
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
