
"use client";

import { useState, useEffect } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  MapPin, 
  Plus, 
  Trash2, 
  Printer, 
  Save, 
  CheckCircle2, 
  Building2, 
  Landmark,
  Calendar as CalendarIcon
} from 'lucide-react';
import { useUser, useFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp, writeBatch, doc } from 'firebase/firestore';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, addDays, parseISO } from 'date-fns';

type AnexoIFila = {
  lugar: string;
  direccion: string;
  fecha_desde: string;
  fecha_hasta: string;
  hora_desde: string;
  hora_hasta: string;
}

export default function AnexoIPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [tipoOficina, setTipoOficina] = useState<'REGISTRO' | 'CENTRO_CIVICO'>('REGISTRO');
  
  const [filas, setFilas] = useState<AnexoIFila[]>(
    Array.from({ length: 10 }, () => ({
      lugar: '',
      direccion: '',
      fecha_desde: '',
      fecha_hasta: '',
      hora_desde: '08:00',
      hora_hasta: '12:00'
    }))
  );

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

  const profile = user?.profile;

  const handleFilaChange = (index: number, field: keyof AnexoIFila, value: string) => {
    const newFilas = [...filas];
    newFilas[index][field] = value;
    setFilas(newFilas);
  };

  const handleSave = async () => {
    if (!firestore || !user) return;
    
    const filledFilas = filas.filter(f => f.lugar.trim() !== '');
    if (filledFilas.length === 0) {
      toast({ variant: "destructive", title: "Formulario vacío", description: "Complete al menos una fila de lugares fijos." });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const batch = writeBatch(firestore);
      const anexoRef = doc(collection(firestore, 'anexo-i'));
      
      const anexoData = {
        tipo_oficina: tipoOficina,
        departamento: profile?.departamento || '',
        distrito: profile?.distrito || '',
        filas: filledFilas,
        usuario_id: user.uid,
        fecha_creacion: new Date().toISOString(),
        server_timestamp: serverTimestamp(),
      };

      batch.set(anexoRef, anexoData);

      // INTEGRACIÓN CON AGENDA: Generar registros individuales por día
      filledFilas.forEach(f => {
        const start = parseISO(f.fecha_desde);
        const end = parseISO(f.fecha_hasta);
        
        let current = start;
        while (current <= end) {
          const agendaRef = doc(collection(firestore, 'solicitudes-capacitacion'));
          const dayStr = format(current, "yyyy-MM-dd");
          
          batch.set(agendaRef, {
            solicitante_entidad: tipoOficina === 'REGISTRO' ? 'OFICINA REGISTRO ELECTORAL' : 'CENTRO CÍVICO',
            tipo_solicitud: 'Lugar Fijo',
            fecha: dayStr,
            hora_desde: f.hora_desde,
            hora_hasta: f.hora_hasta,
            lugar_local: f.lugar.toUpperCase(),
            direccion_calle: f.direccion.toUpperCase(),
            barrio_compania: '',
            departamento: profile?.departamento || '',
            distrito: profile?.distrito || '',
            rol_solicitante: 'otro',
            nombre_completo: 'PLANIFICACIÓN ANEXO I',
            cedula: '',
            telefono: '',
            gps: '',
            usuario_id: user.uid,
            fecha_creacion: new Date().toISOString(),
            server_timestamp: serverTimestamp()
          });
          
          current = addDays(current, 1);
        }
      });

      await batch.commit();
      toast({ title: "Planificación Guardada", description: "Los lugares fijos han sido agendados con éxito." });
      setIsSubmitting(false);
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error al guardar" });
      setIsSubmitting(false);
    }
  };

  const generatePDF = () => {
    if (!logoBase64) return;
    const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.addImage(logoBase64, 'PNG', margin, 10, 15, 15);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text("ANEXO I", 35, 15);
    doc.text("LUGARES FIJOS PARA DIVULGACIÓN MV - INTERIOR", 35, 21);
    doc.setFontSize(11);
    doc.text("Práctica con la Máquina de Votación", 35, 27);

    let y = 40;
    doc.setFontSize(9);
    doc.text("OFICINA DEL REGISTRO ELECTORAL", margin, y);
    doc.rect(margin + 60, y - 4, 5, 5);
    if(tipoOficina === 'REGISTRO') doc.text("X", margin + 61, y);

    doc.text("CENTRO CÍVICO", margin + 80, y);
    doc.rect(margin + 110, y - 4, 5, 5);
    if(tipoOficina === 'CENTRO_CIVICO') doc.text("X", margin + 111, y);

    y += 10;
    doc.text(`DISTRITO DE: _________________________________`, margin, y);
    doc.text((profile?.distrito || '').toUpperCase(), margin + 25, y - 0.5);
    
    doc.text(`DEPARTAMENTO: _________________________________`, margin + 120, y);
    doc.text((profile?.departamento || '').toUpperCase(), margin + 155, y - 0.5);

    const tableBody = filas.map((f, i) => [
      i + 1,
      f.lugar.toUpperCase(),
      f.direccion.toUpperCase(),
      `DEL: ${f.fecha_desde ? format(parseISO(f.fecha_desde), "dd/MM") : '  /  '} AL: ${f.fecha_hasta ? format(parseISO(f.fecha_hasta), "dd/MM") : '  /  '} / 2026`,
      `DE: ${f.hora_desde} A: ${f.hora_hasta} HS.`
    ]);

    autoTable(doc, {
      startY: y + 10,
      head: [['N.º', 'LUGAR FIJO PARA DIVULGACIÓN', 'DIRECCIÓN', 'FECHA', 'HORARIO']],
      body: tableBody,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.1 },
      headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 80 },
        2: { cellWidth: 80 },
        3: { cellWidth: 50, halign: 'center' },
        4: { cellWidth: 40, halign: 'center' }
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 25;
    doc.text("Firma, aclaración y sello jefes", pageWidth - margin - 60, finalY, { align: 'center' });

    doc.setFontSize(7);
    const footerY = doc.internal.pageSize.getHeight() - 15;
    doc.text("Completar todos los datos de lugares fijos y remitir hasta el jueves antes de la semana de inicio de la divulgación a la Coordinación Departamental correspondiente.", margin, footerY);
    doc.text("Coordinación departamental remite a la Dirección del CIDEE.", margin, footerY + 4);

    doc.save(`AnexoI-${(profile?.distrito || 'Planificacion').replace(/\s+/g, '-')}.pdf`);
  };

  if (isUserLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary"/></div>;

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]">
      <Header title="Anexo I - Lugares Fijos" />
      <main className="flex-1 p-4 md:p-8 max-w-[1400px] mx-auto w-full space-y-6">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
                <Image src="/logo.png" alt="Logo" width={50} height={50} className="object-contain" />
                <div>
                    <h1 className="text-2xl font-black uppercase text-primary leading-tight">ANEXO I</h1>
                    <h2 className="text-lg font-black uppercase leading-tight tracking-tight">LUGARES FIJOS PARA DIVULGACIÓN MV</h2>
                </div>
            </div>
            <div className="flex gap-3">
                <Button variant="outline" className="font-black uppercase text-[10px] border-2 h-11 gap-2 shadow-sm" onClick={generatePDF}>
                    <Printer className="h-4 w-4" /> VISTA PREVIA PDF
                </Button>
                <Button className="font-black uppercase text-[10px] h-11 gap-2 shadow-xl" onClick={handleSave} disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    GUARDAR Y AGENDAR
                </Button>
            </div>
        </div>

        <Card className="shadow-2xl border-none overflow-hidden rounded-[2rem] bg-white">
          <CardContent className="p-8 space-y-10">
            
            <div className="flex flex-col md:flex-row gap-12 items-center justify-center p-6 bg-muted/10 rounded-3xl border-2 border-dashed">
                <RadioGroup 
                    value={tipoOficina} 
                    onValueChange={(v: any) => setTipoOficina(v)}
                    className="flex flex-col sm:flex-row gap-10"
                >
                    <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setTipoOficina('REGISTRO')}>
                        <div className={cn("h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all", tipoOficina === 'REGISTRO' ? "border-black bg-black text-white" : "border-muted-foreground/30")}>
                            {tipoOficina === 'REGISTRO' && <CheckCircle2 className="h-4 w-4" />}
                        </div>
                        <Label className="font-black text-xs uppercase cursor-pointer">OFICINA DEL REGISTRO ELECTORAL</Label>
                        <RadioGroupItem value="REGISTRO" className="hidden" />
                    </div>
                    <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setTipoOficina('CENTRO_CIVICO')}>
                        <div className={cn("h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all", tipoOficina === 'CENTRO_CIVICO' ? "border-black bg-black text-white" : "border-muted-foreground/30")}>
                            {tipoOficina === 'CENTRO_CIVICO' && <CheckCircle2 className="h-4 w-4" />}
                        </div>
                        <Label className="font-black text-xs uppercase cursor-pointer">CENTRO CÍVICO</Label>
                        <RadioGroupItem value="CENTRO_CIVICO" className="hidden" />
                    </div>
                </RadioGroup>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-2">
                        <Landmark className="h-3.5 w-3.5" /> Departamento
                    </Label>
                    <Input value={profile?.departamento || ''} readOnly className="h-12 font-black uppercase bg-muted/20 border-2" />
                </div>
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5" /> Distrito
                    </Label>
                    <Input value={profile?.distrito || ''} readOnly className="h-12 font-black uppercase bg-muted/20 border-2" />
                </div>
            </div>

            <div className="border-2 border-black rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-black text-white">
                                <th className="p-4 text-[9px] font-black uppercase w-12 text-center">N.º</th>
                                <th className="p-4 text-[9px] font-black uppercase text-left">Lugar Fijo para Divulgación</th>
                                <th className="p-4 text-[9px] font-black uppercase text-left">Dirección</th>
                                <th className="p-4 text-[9px] font-black uppercase text-center w-[300px]">Fecha (Desde - Hasta)</th>
                                <th className="p-4 text-[9px] font-black uppercase text-center w-[200px]">Horario (De - A)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-black/10">
                            {filas.map((fila, idx) => (
                                <tr key={idx} className="hover:bg-muted/5 transition-colors">
                                    <td className="p-4 text-center font-black text-xs text-muted-foreground border-r">{idx + 1}</td>
                                    <td className="p-2 border-r">
                                        <Input 
                                            value={fila.lugar} 
                                            onChange={e => handleFilaChange(idx, 'lugar', e.target.value.toUpperCase())}
                                            placeholder="Nombre del local..."
                                            className="border-0 focus-visible:ring-0 font-bold uppercase text-[11px] h-10 bg-transparent"
                                        />
                                    </td>
                                    <td className="p-2 border-r">
                                        <Input 
                                            value={fila.direccion} 
                                            onChange={e => handleFilaChange(idx, 'direccion', e.target.value.toUpperCase())}
                                            placeholder="Calle o referencia..."
                                            className="border-0 focus-visible:ring-0 font-bold uppercase text-[11px] h-10 bg-transparent"
                                        />
                                    </td>
                                    <td className="p-2 border-r">
                                        <div className="flex items-center gap-2 justify-center">
                                            <Input 
                                                type="date" 
                                                value={fila.fecha_desde} 
                                                onChange={e => handleFilaChange(idx, 'fecha_desde', e.target.value)}
                                                className="border-2 rounded-lg text-[10px] font-bold h-9 w-32"
                                            />
                                            <span className="text-[9px] font-black opacity-30">AL</span>
                                            <Input 
                                                type="date" 
                                                value={fila.fecha_hasta} 
                                                onChange={e => handleFilaChange(idx, 'fecha_hasta', e.target.value)}
                                                className="border-2 rounded-lg text-[10px] font-bold h-9 w-32"
                                            />
                                        </div>
                                    </td>
                                    <td className="p-2">
                                        <div className="flex items-center gap-2 justify-center">
                                            <Input 
                                                type="time" 
                                                value={fila.hora_desde} 
                                                onChange={e => handleFilaChange(idx, 'hora_desde', e.target.value)}
                                                className="border-2 rounded-lg text-[10px] font-bold h-9 w-20 px-1"
                                            />
                                            <Input 
                                                type="time" 
                                                value={fila.hora_hasta} 
                                                onChange={e => handleFilaChange(idx, 'hora_hasta', e.target.value)}
                                                className="border-2 rounded-lg text-[10px] font-bold h-9 w-20 px-1"
                                            />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="p-6 bg-muted/20 rounded-3xl text-center">
                <p className="text-[10px] font-bold text-muted-foreground uppercase leading-relaxed max-w-3xl mx-auto italic">
                    * Al guardar este formulario, el sistema generará automáticamente las entradas en la Agenda para cada día comprendido en los rangos de fecha seleccionados, facilitando la asignación del personal.
                </p>
            </div>

          </CardContent>
        </Card>
      </main>
    </div>
  );
}
