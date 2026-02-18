
"use client";

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserCheck, CheckCircle2, FileDown, CalendarDays, MousePointerSquareDashed, Camera, Trash2, Image as ImageIcon, Plus, Building2 } from 'lucide-react';
import { useUser, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { Separator } from '@/components/ui/separator';
import jsPDF from 'jspdf';
import { type SolicitudCapacitacion } from '@/lib/data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export default function InformeDivulgadorPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const agendaId = searchParams.get('solicitudId');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [markedCells, setMarcaciones] = useState<number[]>([]);
  const [eventPhotos, setEventPhotos] = useState<string[]>([]);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    lugar_divulgacion: '',
    fecha: '',
    hora_desde: '',
    hora_hasta: '',
    nombre_divulgador: '',
    cedula_divulgador: '',
    vinculo: '',
    oficina: '',
  });

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

  useEffect(() => {
    if (!isUserLoading && user?.profile && !agendaId) {
      setFormData(prev => ({
        ...prev,
        nombre_divulgador: user.profile?.username || '',
        cedula_divulgador: user.profile?.cedula || '',
        vinculo: user.profile?.vinculo || '',
        oficina: user.profile?.distrito || '',
      }));
    }
  }, [user, isUserLoading, agendaId]);

  const agendaQuery = useMemoFirebase(() => {
    if (!firestore || !user?.profile?.distrito) return null;
    return query(
      collection(firestore, 'solicitudes-capacitacion'),
      where('departamento', '==', user.profile.departamento),
      where('distrito', '==', user.profile.distrito)
    );
  }, [firestore, user]);

  const { data: agendaItems, isLoading: isLoadingAgenda } = useCollection<SolicitudCapacitacion>(agendaQuery);

  useEffect(() => {
    if (agendaId && agendaItems) {
      const item = agendaItems.find(a => a.id === agendaId);
      if (item) {
        setFormData(prev => ({
          ...prev,
          lugar_divulgacion: item.lugar_local,
          fecha: item.fecha,
          hora_desde: item.hora_desde,
          hora_hasta: item.hora_hasta,
          nombre_divulgador: item.divulgador_nombre || '',
          cedula_divulgador: item.divulgador_cedula || '',
          vinculo: item.divulgador_vinculo || '',
          oficina: item.distrito || '',
        }));
      }
    }
  }, [agendaId, agendaItems]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAgendaSelect = (id: string) => {
    const item = agendaItems?.find(a => a.id === id);
    if (item) {
      setFormData(prev => ({
        ...prev,
        lugar_divulgacion: item.lugar_local,
        fecha: item.fecha,
        hora_desde: item.hora_desde,
        hora_hasta: item.hora_hasta,
        nombre_divulgador: item.divulgador_nombre || '',
        cedula_divulgador: item.divulgador_cedula || '',
        vinculo: item.divulgador_vinculo || '',
        oficina: item.distrito || '',
      }));
      toast({ title: "Datos cargados" });
    }
  };

  const toggleCell = (num: number) => {
    setMarcaciones(prev => prev.includes(num) ? prev.filter(n => n !== num) : [...prev, num]);
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (eventPhotos.length >= 3) {
        toast({ variant: "destructive", title: "Límite alcanzado" });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setEventPhotos(prev => [...prev, reader.result as string]);
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleSubmit = async () => {
    if (!firestore || !user) return;
    if (!formData.lugar_divulgacion || !formData.fecha) {
        toast({ variant: "destructive", title: "Faltan datos" });
        return;
    }

    setIsSubmitting(true);
    const docData = {
      ...formData,
      departamento: user.profile?.departamento || '',
      distrito: user.profile?.distrito || '',
      total_personas: markedCells.length,
      marcaciones: markedCells,
      fotos: eventPhotos,
      usuario_id: user.uid,
      fecha_creacion: new Date().toISOString(),
      server_timestamp: serverTimestamp(),
    };

    try {
      await addDoc(collection(firestore, 'informes-divulgador'), docData);
      toast({ title: "¡Informe Guardado!" });
      setMarcaciones([]);
      setEventPhotos([]);
    } catch (error) {
      const contextualError = new FirestorePermissionError({
        path: 'informes-divulgador',
        operation: 'create',
        requestResourceData: docData
      });
      errorEmitter.emit('permission-error', contextualError);
    } finally { setIsSubmitting(false); }
  };

  const generatePDF = async () => {
    const doc = new jsPDF();
    const margin = 15;
    if (logoBase64) doc.addImage(logoBase64, 'PNG', margin, 5, 18, 18);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text("INFORME DEL DIVULGADOR (ANEXO III)", 105, 15, { align: "center" });
    
    let y = 35;
    const drawLine = (label: string, value: string, currentY: number) => {
        doc.setFont('helvetica', 'bold');
        doc.text(`${label}:`, margin, currentY);
        doc.setFont('helvetica', 'normal');
        doc.text((value || '').toUpperCase(), margin + 50, currentY);
        doc.line(margin + 50, currentY + 1, 195, currentY + 1);
        return currentY + 8;
    };

    y = drawLine("LUGAR", formData.lugar_divulgacion, y);
    y = drawLine("FECHA", formData.fecha, y);
    y = drawLine("DIVULGADOR", formData.nombre_divulgador, y);
    y = drawLine("TOTAL PERSONAS", `${markedCells.length}`, y);

    y += 10;
    doc.text("__________________________________", 50, y + 50, { align: "center" });
    doc.text("Firma Divulgador", 50, y + 55, { align: "center" });
    doc.text("__________________________________", 150, y + 50, { align: "center" });
    doc.text("Firma Jefes", 150, y + 55, { align: "center" });

    doc.save(`AnexoIII-${formData.cedula_divulgador}.pdf`);
  };

  if (isUserLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <Header title="Anexo III" />
      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-4xl mb-6">
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2"><CalendarDays className="h-4 w-4" /> VINCULAR AGENDA</CardTitle>
            </CardHeader>
            <CardContent>
              <Select onValueChange={handleAgendaSelect} defaultValue={agendaId || undefined}>
                <SelectTrigger><SelectValue placeholder="Seleccionar actividad..." /></SelectTrigger>
                <SelectContent>
                  {agendaItems?.map(item => (
                    <SelectItem key={item.id} value={item.id}>{item.fecha} - {item.lugar_local}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>

        <Card className="mx-auto max-w-4xl shadow-xl border-t-4 border-t-primary">
          <CardHeader className="bg-primary/5">
            <CardTitle className="flex items-center gap-2"><UserCheck className="h-6 w-6 text-primary" /> Informe Anexo III</CardTitle>
          </CardHeader>
          <CardContent className="space-y-8 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/30 p-6 rounded-xl border-2 border-dashed">
              <div className="space-y-2">
                <Label className="font-black text-primary text-[10px] uppercase">Nombre Completo</Label>
                <Input value={formData.nombre_divulgador} readOnly className="bg-white font-bold" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-black text-primary text-[10px] uppercase">C.I.C.</Label>
                  <Input value={formData.cedula_divulgador} readOnly className="bg-white font-bold" />
                </div>
                <div className="space-y-2">
                  <Label className="font-black text-primary text-[10px] uppercase">Vínculo</Label>
                  <Input value={formData.vinculo} readOnly className="bg-white font-bold" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input name="lugar_divulgacion" value={formData.lugar_divulgacion} onChange={handleInputChange} placeholder="Lugar" />
              <div className="grid grid-cols-2 gap-4">
                <Input name="fecha" type="date" value={formData.fecha} onChange={handleInputChange} />
                <div className="text-2xl font-black text-primary bg-primary/10 rounded-md p-2 text-center">{markedCells.length}</div>
              </div>
            </div>

            <div className="space-y-4">
                <Label className="font-bold">MARCACIONES (TÁCTIL)</Label>
                <div className="grid grid-cols-6 sm:grid-cols-10 md:grid-cols-13 border rounded-lg overflow-hidden bg-background">
                    {Array.from({ length: 104 }, (_, i) => i + 1).map(num => (
                        <div key={num} onClick={() => toggleCell(num)} className={cn("aspect-square border flex flex-col items-center justify-center cursor-pointer hover:bg-primary/5", markedCells.includes(num) ? "bg-primary/10" : "")}>
                            <span className="text-[10px] text-muted-foreground">{num}</span>
                            <span className="text-xl font-black text-primary">{markedCells.includes(num) ? "X" : ""}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="space-y-6">
              <Label className="font-bold flex items-center gap-2"><ImageIcon className="h-5 w-5" /> FOTOS (MÁX. 3)</Label>
              <div className="flex gap-2">
                <label className="cursor-pointer bg-primary/10 text-primary px-4 py-2 rounded text-sm font-bold">Cámara<Input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoCapture} /></label>
                <label className="cursor-pointer border border-primary/20 px-4 py-2 rounded text-sm font-bold">Galería<Input type="file" accept="image/*" className="hidden" onChange={handlePhotoCapture} /></label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {eventPhotos.map((photo, index) => (
                  <div key={index} className="relative aspect-video border rounded overflow-hidden">
                    <Image src={photo} alt="Evento" fill className="object-cover" />
                    <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={() => setEventPhotos(p => p.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex gap-4 border-t p-6">
            <Button onClick={generatePDF} variant="outline" className="font-bold">ANEXO III (PDF)</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting} className="flex-1 font-bold">GUARDAR INFORME</Button>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
