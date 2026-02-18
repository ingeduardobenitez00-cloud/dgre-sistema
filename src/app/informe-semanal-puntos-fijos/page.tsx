
"use client";

import { useState, useEffect } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, TableProperties, CheckCircle2, FileDown, Plus, Trash2 } from 'lucide-react';
import { useUser, useFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Separator } from '@/components/ui/separator';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { type InformeSemanalFila } from '@/lib/data';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

const EMPTY_ROW: InformeSemanalFila = {
  lugar: '',
  fecha: '',
  hora_desde: '',
  hora_hasta: '',
  nombre_divulgador: '',
  cedula: '',
  vinculo: '',
  cantidad_personas: 0,
};

export default function InformeSemanalAnexoIVPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    semana_desde: '',
    semana_hasta: '',
  });

  const [filas, setFilas] = useState<InformeSemanalFila[]>(
    Array(12).fill(null).map(() => ({ ...EMPTY_ROW }))
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFilaChange = (index: number, field: keyof InformeSemanalFila, value: string | number) => {
    const newFilas = [...filas];
    newFilas[index] = { ...newFilas[index], [field]: value };
    setFilas(newFilas);
  };

  const handleSubmit = async () => {
    if (!firestore || !user) return;
    
    if (!formData.semana_desde || !formData.semana_hasta) {
        toast({ variant: "destructive", title: "Faltan fechas", description: "Por favor complete el rango de la semana." });
        return;
    }

    setIsSubmitting(true);
    try {
      const informeData = {
        ...formData,
        departamento: user.profile?.departamento || '',
        distrito: user.profile?.distrito || '',
        filas: filas.filter(f => f.lugar || f.nombre_divulgador), // Solo guardar filas con datos
        usuario_id: user.uid,
        fecha_creacion: new Date().toISOString(),
        server_timestamp: serverTimestamp(),
      };
      await addDoc(collection(firestore, 'informes-semanales-anexo-iv'), informeData);
      
      toast({ title: "¡Informe Guardado!", description: "El informe semanal ha sido registrado con éxito." });
      
      setFormData({ semana_desde: '', semana_hasta: '' });
      setFilas(Array(12).fill(null).map(() => ({ ...EMPTY_ROW })));
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo guardar el informe." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const generatePDF = () => {
    setIsGeneratingPdf(true);
    try {
        const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' }) as jsPDFWithAutoTable;
        const margin = 10;
        const pageWidth = doc.internal.pageSize.getWidth();

        if (logoBase64) {
            doc.addImage(logoBase64, 'PNG', margin, 5, 15, 15);
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text("ANEXO IV", pageWidth / 2, 12, { align: "center" });
        doc.setFontSize(12);
        doc.text("INFORME SEMANAL PUNTOS FIJOS DE DIVULGACIÓN 2026", pageWidth / 2, 18, { align: "center" });

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        
        const yInfo = 28;
        doc.text(`SEMANA DEL LUNES: ${formData.semana_desde || '__/__/2026'}`, margin, yInfo);
        doc.text(`AL DOMINGO: ${formData.semana_hasta || '__/__/2026'}`, margin + 80, yInfo);
        
        doc.text(`DISTRITO: ${(user?.profile?.distrito || '').toUpperCase()}`, margin, yInfo + 6);
        doc.text(`DEPARTAMENTO: ${(user?.profile?.departamento || '').toUpperCase()}`, margin + 80, yInfo + 6);

        const tableBody = filas.map((f, i) => [
            i + 1,
            f.lugar.toUpperCase(),
            f.fecha,
            `DE: ${f.hora_desde} A: ${f.hora_hasta} HS.`,
            f.nombre_divulgador.toUpperCase(),
            f.cedula,
            f.vinculo.toUpperCase(),
            f.cantidad_personas || ''
        ]);

        autoTable(doc, {
            startY: 45,
            head: [[
                'N.º', 
                'LUGAR DE DIVULGACIÓN', 
                'FECHA', 
                'HORARIO', 
                'NOMBRE COMPLETO FUNCIONARIO DIVULGADOR', 
                'C.I.C. N.º', 
                'VÍNCULO', 
                'CANT. PERS.'
            ]],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold', halign: 'center', fontSize: 7 },
            styles: { fontSize: 7, cellPadding: 2, halign: 'center' },
            columnStyles: {
                0: { cellWidth: 8 },
                1: { cellWidth: 45, halign: 'left' },
                2: { cellWidth: 20 },
                3: { cellWidth: 35 },
                4: { cellWidth: 50, halign: 'left' },
                5: { cellWidth: 20 },
                6: { cellWidth: 35 },
                7: { cellWidth: 15 },
            },
            margin: { left: margin, right: margin }
        });

        const finalY = (doc as any).lastAutoTable.finalY + 20;
        doc.line(pageWidth - 80, finalY, pageWidth - margin, finalY);
        doc.setFontSize(8);
        doc.text("FIRMA Y SELLO DE LOS JEFES", pageWidth - 45, finalY + 5, { align: "center" });

        doc.save(`AnexoIV-${user?.profile?.distrito || 'Semanal'}.pdf`);
    } catch (error) {
        console.error(error);
        toast({ variant: "destructive", title: "Error", description: "No se pudo generar el PDF." });
    } finally {
        setIsGeneratingPdf(false);
    }
  };

  if (isUserLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <Header title="Informe Semanal - Anexo IV" />
      <main className="flex-1 p-4 md:p-8">
        <Card className="mx-auto max-w-7xl shadow-xl border-t-4 border-t-primary">
          <CardHeader className="bg-primary/5">
            <CardTitle className="flex items-center gap-2">
              <TableProperties className="h-6 w-6 text-primary" />
              ANEXO IV - INFORME SEMANAL PUNTOS FIJOS DE DIVULGACIÓN
            </CardTitle>
            <CardDescription>Resumen de actividades semanales por distrito.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <Label htmlFor="semana_desde">SEMANA DEL LUNES</Label>
                <Input id="semana_desde" name="semana_desde" type="date" value={formData.semana_desde} onChange={handleInputChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="semana_hasta">AL DOMINGO</Label>
                <Input id="semana_hasta" name="semana_hasta" type="date" value={formData.semana_hasta} onChange={handleInputChange} />
              </div>
              <div className="space-y-2">
                <Label>DEPARTAMENTO</Label>
                <Input value={user?.profile?.departamento || ''} disabled className="bg-muted font-bold" />
              </div>
              <div className="space-y-2">
                <Label>DISTRITO</Label>
                <Input value={user?.profile?.distrito || ''} disabled className="bg-muted font-bold" />
              </div>
            </div>

            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted border-b">
                    <th className="p-2 text-center border-r w-10">N.º</th>
                    <th className="p-2 text-left border-r min-w-[200px]">LUGAR DE DIVULGACIÓN</th>
                    <th className="p-2 text-center border-r w-32">FECHA</th>
                    <th className="p-2 text-center border-r min-w-[180px]">HORARIO (DE / A)</th>
                    <th className="p-2 text-left border-r min-w-[200px]">FUNCIONARIO DIVULGADOR</th>
                    <th className="p-2 text-center border-r w-28">C.I.C. N.º</th>
                    <th className="p-2 text-center border-r w-32">VÍNCULO</th>
                    <th className="p-2 text-center w-24">CANT. PERS.</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filas.map((fila, i) => (
                    <tr key={i} className="hover:bg-primary/5 transition-colors">
                      <td className="p-2 text-center font-bold border-r">{i + 1}</td>
                      <td className="p-1 border-r">
                        <Input className="h-8 text-[10px] uppercase" value={fila.lugar} onChange={(e) => handleFilaChange(i, 'lugar', e.target.value)} />
                      </td>
                      <td className="p-1 border-r">
                        <Input type="date" className="h-8 text-[10px]" value={fila.fecha} onChange={(e) => handleFilaChange(i, 'fecha', e.target.value)} />
                      </td>
                      <td className="p-1 border-r">
                        <div className="flex items-center gap-1">
                          <Input type="time" className="h-8 text-[10px] w-full" value={fila.hora_desde} onChange={(e) => handleFilaChange(i, 'hora_desde', e.target.value)} />
                          <span>-</span>
                          <Input type="time" className="h-8 text-[10px] w-full" value={fila.hora_hasta} onChange={(e) => handleFilaChange(i, 'hora_hasta', e.target.value)} />
                        </div>
                      </td>
                      <td className="p-1 border-r">
                        <Input className="h-8 text-[10px] uppercase" value={fila.nombre_divulgador} onChange={(e) => handleFilaChange(i, 'nombre_divulgador', e.target.value)} />
                      </td>
                      <td className="p-1 border-r">
                        <Input className="h-8 text-[10px]" value={fila.cedula} onChange={(e) => handleFilaChange(i, 'cedula', e.target.value)} />
                      </td>
                      <td className="p-1 border-r">
                        <Input className="h-8 text-[10px] uppercase" placeholder="P/C/C" value={fila.vinculo} onChange={(e) => handleFilaChange(i, 'vinculo', e.target.value)} />
                      </td>
                      <td className="p-1">
                        <Input type="number" className="h-8 text-[10px] text-center" value={fila.cantidad_personas} onChange={(e) => handleFilaChange(i, 'cantidad_personas', parseInt(e.target.value) || 0)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row gap-4 bg-muted/10 border-t p-6">
            <Button onClick={generatePDF} variant="outline" className="w-full sm:w-auto font-bold h-12" disabled={isGeneratingPdf}>
              {isGeneratingPdf ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : <FileDown className="mr-2 h-5 w-5" />} GENERAR ANEXO IV (PDF)
            </Button>
            <div className="flex-1" />
            <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full sm:w-auto px-10 h-12 font-bold text-lg">
              {isSubmitting ? <><Loader2 className="animate-spin mr-2 h-5 w-5" /> GUARDANDO...</> : <><CheckCircle2 className="mr-2 h-5 w-5" /> GUARDAR INFORME SEMANAL</>}
            </Button>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
