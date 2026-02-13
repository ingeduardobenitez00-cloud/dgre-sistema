
"use client";

import { useState, useEffect } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MapPin, FileText, Camera, CheckCircle2, RefreshCw } from 'lucide-react';
import { useUser, useFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import jsPDF from 'jspdf';
import { type SolicitudCapacitacion } from '@/lib/data';

export default function SolicitudCapacitacionPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    solicitante: '',
    cedula: '',
    nombre_apellido: '',
    fecha: '',
    hora: '',
    lugar: '',
    gps: '',
  });

  const [isCapturingGps, setIsCapturingGps] = useState(false);
  const [pdfGenerated, setPdfGenerated] = useState(false);
  const [photoDataUri, setPhotoDataUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleGetGps = () => {
    setIsCapturingGps(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = `${position.coords.latitude}, ${position.coords.longitude}`;
          setFormData(prev => ({ ...prev, gps: coords }));
          setIsCapturingGps(false);
          toast({ title: "Ubicación obtenida", description: coords });
        },
        (error) => {
          console.error("Error getting location:", error);
          setIsCapturingGps(false);
          toast({ variant: "destructive", title: "Error GPS", description: "No se pudo obtener la ubicación." });
        }
      );
    } else {
      setIsCapturingGps(false);
      toast({ variant: "destructive", title: "GPS no disponible", description: "Tu navegador no soporta geolocalización." });
    }
  };

  const generatePdf = () => {
    if (!formData.solicitante || !formData.cedula || !formData.nombre_apellido) {
      toast({ variant: "destructive", title: "Faltan datos", description: "Por favor completa el nombre y la cédula." });
      return;
    }

    const doc = new jsPDF();
    const margin = 20;
    let y = 30;

    doc.setFontSize(18);
    doc.text("SOLICITUD DE CAPACITACIÓN", 105, y, { align: "center" });
    y += 20;

    doc.setFontSize(12);
    doc.text(`Solicitante: ${formData.solicitante}`, margin, y); y += 10;
    doc.text(`N° de Cédula: ${formData.cedula}`, margin, y); y += 10;
    doc.text(`Nombre y Apellido: ${formData.nombre_apellido}`, margin, y); y += 15;
    
    doc.text(`Fecha Solicitada: ${formData.fecha}`, margin, y); y += 10;
    doc.text(`Hora: ${formData.hora}`, margin, y); y += 10;
    doc.text(`Lugar: ${formData.lugar}`, margin, y); y += 10;
    doc.text(`Coordenadas GPS: ${formData.gps}`, margin, y); y += 20;

    doc.text("__________________________", 105, y + 40, { align: "center" });
    doc.text("Firma del Solicitante", 105, y + 50, { align: "center" });

    doc.save(`Solicitud-${formData.cedula}.pdf`);
    setPdfGenerated(true);
    toast({ title: "PDF Generado", description: "Ahora puedes imprimirlo, firmarlo y quitar una foto." });
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoDataUri(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!firestore || !user || !user.profile) return;
    if (!photoDataUri) {
      toast({ variant: "destructive", title: "Foto requerida", description: "Debes adjuntar la foto de la solicitud firmada." });
      return;
    }

    setIsSubmitting(true);
    try {
      const solicitudData = {
        ...formData,
        foto_firma: photoDataUri,
        departamento: user.profile.departamento,
        distrito: user.profile.distrito,
        usuario_id: user.uid,
        fecha_creacion: new Date().toISOString(),
        server_timestamp: serverTimestamp(),
      };

      await addDoc(collection(firestore, 'solicitudes-capacitacion'), solicitudData);
      
      toast({ title: "Solicitud Guardada", description: "La capacitación ha sido agendada con éxito." });
      
      // Reset form
      setFormData({
        solicitante: '',
        cedula: '',
        nombre_apellido: '',
        fecha: '',
        hora: '',
        lugar: '',
        gps: '',
      });
      setPhotoDataUri(null);
      setPdfGenerated(false);
    } catch (error) {
      console.error("Error saving request:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo guardar la solicitud." });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isUserLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8"/></div>;

  return (
    <div className="flex min-h-screen flex-col">
      <Header title="Nueva Solicitud de Capacitación" />
      <main className="flex-1 p-4 md:p-8">
        <Card className="mx-auto max-w-2xl">
          <CardHeader>
            <CardTitle>Formulario de Solicitud</CardTitle>
            <CardDescription>Completa los datos según dicta el solicitante. Luego genera el PDF para la firma física.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="solicitante">Solicitante (Entidad/Referente)</Label>
                <Input id="solicitante" name="solicitante" value={formData.solicitante} onChange={handleInputChange} placeholder="Ej: Municipalidad de..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cedula">N° de Cédula</Label>
                <Input id="cedula" name="cedula" value={formData.cedula} onChange={handleInputChange} placeholder="Documento de identidad" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nombre_apellido">Nombre y Apellido del Solicitante</Label>
              <Input id="nombre_apellido" name="nombre_apellido" value={formData.nombre_apellido} onChange={handleInputChange} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fecha">Fecha de Capacitación</Label>
                <Input id="fecha" name="fecha" type="date" value={formData.fecha} onChange={handleInputChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hora">Hora</Label>
                <Input id="hora" name="hora" type="time" value={formData.hora} onChange={handleInputChange} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lugar">Lugar de Realización</Label>
              <Input id="lugar" name="lugar" value={formData.lugar} onChange={handleInputChange} placeholder="Dirección o local" />
            </div>
            <div className="space-y-2">
              <Label>Georeferenciación (GPS)</Label>
              <div className="flex gap-2">
                <Input name="gps" value={formData.gps} readOnly placeholder="Coordenadas" className="bg-muted" />
                <Button type="button" onClick={handleGetGps} disabled={isCapturingGps} variant="outline">
                  {isCapturingGps ? <Loader2 className="animate-spin h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <Separator className="my-6" />

            <div className="space-y-6">
              <div className="flex flex-col items-center gap-4">
                <Button onClick={generatePdf} className="w-full sm:w-auto" variant="secondary">
                  <FileText className="mr-2 h-4 w-4" />
                  Generar Solicitud en PDF
                </Button>
                {pdfGenerated && (
                  <p className="text-sm text-green-600 font-medium flex items-center">
                    <CheckCircle2 className="mr-1 h-4 w-4" /> PDF generado. Favor imprimir y firmar.
                  </p>
                )}
              </div>

              {pdfGenerated && (
                <div className="rounded-lg border-2 border-dashed p-6 text-center">
                  <Label className="block mb-4 text-lg font-semibold">Foto de la Solicitud Firmada</Label>
                  {photoDataUri ? (
                    <div className="relative mx-auto aspect-[3/4] max-w-[200px] overflow-hidden rounded-md border">
                      <Image src={photoDataUri} alt="Firma" fill className="object-cover" />
                      <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-8 w-8" onClick={() => setPhotoDataUri(null)}>
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4">
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Camera className="h-10 w-10" />
                      </div>
                      <label htmlFor="photo-upload" className="cursor-pointer">
                        <div className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                          Quitar Foto / Subir Imagen
                        </div>
                        <Input id="photo-upload" type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoCapture} />
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleSubmit} disabled={isSubmitting || !photoDataUri} className="w-full" size="lg">
              {isSubmitting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Finalizar y Agendar Solicitud
            </Button>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}

import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
