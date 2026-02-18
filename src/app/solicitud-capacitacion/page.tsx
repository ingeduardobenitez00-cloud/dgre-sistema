
"use client";

import { useState, useEffect, useRef } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MapPin, FileText, Camera, CheckCircle2, RefreshCw, MousePointer2, Upload } from 'lucide-react';
import { useUser, useFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export default function SolicitudCapacitacionPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    solicitante_entidad: '',
    tipo_solicitud: 'divulgacion',
    fecha: '',
    hora_desde: '',
    hora_hasta: '',
    lugar_local: '',
    direccion_calle: '',
    barrio_compania: '',
    rol_solicitante: 'apoderado',
    nombre_completo: '',
    cedula: '',
    telefono: '',
    gps: '',
  });

  const [coords, setCoords] = useState<{ lat: string; lng: string }>({ lat: '', lng: '' });
  const [photoDataUri, setPhotoDataUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<any>(null);
  const markerRef = useRef<any>(null);

  // Set initial dates client-side
  useEffect(() => {
    const now = new Date();
    setFormData(prev => ({
      ...prev,
      fecha: now.toISOString().split('T')[0],
      hora_desde: '08:00',
      hora_hasta: '12:00'
    }));
  }, []);

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
    let isMounted = true;
    const initMap = async () => {
      await new Promise(resolve => setTimeout(resolve, 300));
      if (typeof window !== 'undefined' && mapRef.current && !leafletMap.current) {
        try {
          const L = (await import('leaflet')).default;
          if (!isMounted || !mapRef.current) return;
          delete (L.Icon.Default.prototype as any)._getIconUrl;
          L.Icon.Default.mergeOptions({
            iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
            iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
            shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
          });
          const defaultPos: [number, number] = [-25.3006, -57.6359];
          const map = L.map(mapRef.current, { center: defaultPos, zoom: 15, doubleClickZoom: false, attributionControl: false });
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
          
          map.on('dblclick', (e: any) => {
            const { lat, lng } = e.latlng;
            const latStr = lat.toFixed(6);
            const lngStr = lng.toFixed(6);
            setCoords({ lat: latStr, lng: lngStr });
            setFormData(prev => ({ ...prev, gps: `${latStr}, ${lngStr}` }));
            if (markerRef.current) markerRef.current.setLatLng(e.latlng);
            else markerRef.current = L.marker(e.latlng).addTo(map);
          });
          leafletMap.current = map;
        } catch (error) { console.error("Error mapa:", error); }
      }
    };
    initMap();
    return () => { isMounted = false; if (leafletMap.current) { leafletMap.current.remove(); leafletMap.current = null; } };
  }, []);

  const handleInputChange = (e: any) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const generatePdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const doc = new jsPDF();
      const margin = 15;
      if (logoBase64) doc.addImage(logoBase64, 'PNG', margin, 5, 18, 18);

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text("Justicia Electoral", 105, 12, { align: "center" });
      
      doc.setFillColor(230, 230, 220);
      doc.rect(margin, 22, 180, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.text("ANEXO V – PROFORMA DE SOLICITUD", 105, 26.5, { align: "center" });

      const today = new Date();
      doc.setFontSize(9);
      doc.text(`${user?.profile?.distrito || ''}, ${today.getDate()} de ${today.toLocaleString('es-ES', { month: 'long' })} de ${today.getFullYear()}`, 195, 35, { align: "right" });

      let tableY = 92;
      const drawRow = (label: string, value: string, y: number, h: number = 7) => {
        doc.line(margin, y, 195, y);
        doc.setFont('helvetica', 'bold');
        doc.text(label, margin + 2, y + 4.5);
        doc.setFont('helvetica', 'normal');
        doc.text(`: ${value || ''}`, margin + 45, y + 4.5);
        doc.line(margin, y + h, 195, y + h);
        return y + h;
      };

      tableY = drawRow("FECHA", formData.fecha, tableY);
      tableY = drawRow("LUGAR Y/O LOCAL", formData.lugar_local, tableY);
      tableY = drawRow("NOMBRE SOLICITANTE", formData.nombre_completo, tableY);

      if (mapRef.current && formData.gps) {
        doc.addPage();
        const canvas = await html2canvas(mapRef.current, { useCORS: true });
        doc.addImage(canvas.toDataURL('image/png'), 'PNG', margin, 30, 180, 100);
        doc.text(`GPS: ${formData.gps}`, margin, 140);
        
        let sigY = 175;
        doc.text("___________________________", 55, sigY, { align: "center" });
        doc.text("Firma, aclaración y sello Jefe", 55, sigY + 5, { align: "center" });
        doc.text("___________________________", 155, sigY, { align: "center" });
        doc.text("Firma, aclaración y sello Jefe", 155, sigY + 5, { align: "center" });
      }

      doc.save(`AnexoV-${formData.cedula || 'Solicitud'}.pdf`);
    } catch (error) { toast({ variant: "destructive", title: "Error PDF" }); }
    finally { setIsGeneratingPdf(false); }
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPhotoDataUri(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!firestore || !user) return;
    setIsSubmitting(true);
    const docData = {
      ...formData,
      departamento: user.profile?.departamento || '',
      distrito: user.profile?.distrito || '',
      foto_firma: photoDataUri || '',
      usuario_id: user.uid,
      fecha_creacion: new Date().toISOString(),
      server_timestamp: serverTimestamp(),
    };

    try {
      await addDoc(collection(firestore, 'solicitudes-capacitacion'), docData);
      toast({ title: "¡Guardado!", description: "La actividad ha sido agendada." });
      setFormData(p => ({ ...p, solicitante_entidad: '', lugar_local: '', nombre_completo: '', cedula: '', telefono: '' }));
      setPhotoDataUri(null);
    } catch (error) {
      const contextualError = new FirestorePermissionError({
        path: 'solicitudes-capacitacion',
        operation: 'create',
        requestResourceData: docData
      });
      errorEmitter.emit('permission-error', contextualError);
    } finally { setIsSubmitting(false); }
  };

  if (isUserLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <Header title="Nueva Solicitud" />
      <main className="flex-1 p-4 md:p-8">
        <Card className="mx-auto max-w-4xl shadow-xl border-t-4 border-t-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText className="h-6 w-6 text-primary" /> Anexo V - Solicitud</CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-2">
                <Label htmlFor="solicitante_entidad">ENTIDAD SOLICITANTE</Label>
                <Input id="solicitante_entidad" name="solicitante_entidad" value={formData.solicitante_entidad} onChange={handleInputChange} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input name="fecha" type="date" value={formData.fecha} onChange={handleInputChange} />
                <Input name="hora_desde" type="time" value={formData.hora_desde} onChange={handleInputChange} />
                <Input name="hora_hasta" type="time" value={formData.hora_hasta} onChange={handleInputChange} />
              </div>
              <Input name="lugar_local" value={formData.lugar_local} onChange={handleInputChange} placeholder="Lugar o Local" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input name="nombre_completo" value={formData.nombre_completo} onChange={handleInputChange} placeholder="Nombre Solicitante" />
                <Input name="cedula" value={formData.cedula} onChange={handleInputChange} placeholder="Cédula" />
              </div>
            </div>

            <div className="space-y-4 border rounded-xl p-5 bg-background">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-primary font-bold"><MapPin className="h-5 w-5" /> GEORREFERENCIACIÓN</div>
              </div>
              <div className="relative w-full rounded-xl overflow-hidden border" style={{ height: '300px' }}>
                <div ref={mapRef} className="h-full w-full" />
              </div>
            </div>

            <div className="flex flex-col items-center gap-6">
              <Button onClick={generatePdf} variant="outline" disabled={isGeneratingPdf}>PDF OFICIAL</Button>
              <div className="rounded-xl border-2 border-dashed p-6 w-full text-center">
                <Label className="block mb-4">ADJUNTAR FIRMA/FOTO</Label>
                {photoDataUri ? (
                  <div className="relative mx-auto w-48 h-64 border rounded overflow-hidden">
                    <Image src={photoDataUri} alt="Firma" fill className="object-cover" />
                    <Button variant="destructive" size="icon" className="absolute top-1 right-1" onClick={() => setPhotoDataUri(null)}><RefreshCw className="h-4 w-4" /></Button>
                  </div>
                ) : (
                  <div className="flex justify-center gap-4">
                    <label className="cursor-pointer bg-primary text-white px-4 py-2 rounded">Galería<Input type="file" className="hidden" accept="image/*" onChange={handlePhotoCapture} /></label>
                    <label className="cursor-pointer border border-primary text-primary px-4 py-2 rounded">Cámara<Input type="file" className="hidden" accept="image/*" capture="environment" onChange={handlePhotoCapture} /></label>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full h-12 font-bold uppercase">GUARDAR Y AGENDAR</Button>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
