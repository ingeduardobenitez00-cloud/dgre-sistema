"use client";

import { useState, useEffect, Suspense, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserCheck, FileDown, CalendarDays, Camera, Trash2, Image as ImageIcon, Plus, X } from 'lucide-react';
import { useUser, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit } from 'firebase/firestore';
import { Separator } from '@/components/ui/separator';
import jsPDF from 'jspdf';
import { type SolicitudCapacitacion } from '@/lib/data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, formatDateToDDMMYYYY } from '@/lib/utils';
import Image from 'next/image';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

// --- Helper Functions ---
function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<F>): Promise<ReturnType<F>> =>
      new Promise(resolve => {
        if (timeout) {
          clearTimeout(timeout);
        }
        timeout = setTimeout(() => resolve(func(...args)), waitFor);
      });
}

function InformeContent() {
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
    departamento: '',
  });

  // State para búsqueda de Cédula del Divulgador
  const [isSearchingCedula, setIsSearchingCedula] = useState(false);
  const [padronFound, setPadronFound] = useState(false);

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
        departamento: user.profile?.departamento || '',
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

  const { data: agendaItems } = useCollection<SolicitudCapacitacion>(agendaQuery);

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
          departamento: item.departamento || '',
        }));
      }
    }
  }, [agendaId, agendaItems]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // --- Lógica de Búsqueda en Padrón ---
  const searchCedulaInPadron = useCallback(async (cedula: string) => {
    if (!firestore || !cedula || cedula.length < 4) {
      setPadronFound(false);
      return;
    }
    setIsSearchingCedula(true);
    try {
      const padronRef = collection(firestore, 'padron');
      const cleanedCedula = cedula.replace(/[.,-]/g, '');
      const q = query(padronRef, where('cedula', '==', cleanedCedula), limit(1));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0].data();
        const fullName = `${userDoc.nombre || ''} ${userDoc.apellido || ''}`.trim();
        setFormData(prev => ({ ...prev, nombre_divulgador: fullName, cedula_divulgador: cedula }));
        setPadronFound(true);
        toast({ title: "Divulgador Encontrado", description: `Datos de ${fullName} cargados.` });
      } else {
        setPadronFound(false);
      }
    } catch (error) {
      console.error("Error searching cedula:", error);
      setPadronFound(false);
    } finally {
      setIsSearchingCedula(false);
    }
  }, [firestore, toast]);

  const debouncedSearch = useMemo(() => debounce(searchCedulaInPadron, 500), [searchCedulaInPadron]);

  const handleCedulaDivulgadorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setFormData(prev => ({ ...prev, cedula_divulgador: value, nombre_divulgador: '' }));
    setPadronFound(false);
    debouncedSearch(value);
  };

  const clearDivulgadorData = () => {
      setFormData(p => ({ ...p, nombre_divulgador: '', cedula_divulgador: '' }));
      setPadronFound(false);
  }

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
        departamento: item.departamento || '',
      }));
      toast({ title: "Datos cargados" });
    }
  };

  const toggleCell = (num: number) => {
    setMarcaciones(prev => prev.includes(num) ? prev.filter(n => n !== num) : [...prev, num]);
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => { /* ... */ };

  const handleSubmit = async () => {
    if (!firestore || !user) return;
    if (!formData.lugar_divulgacion || !formData.fecha) {
        toast({ variant: "destructive", title: "Faltan datos" });
        return;
    }

    setIsSubmitting(true);
    const docData = {
      ...formData,
      departamento: formData.departamento || user.profile?.departamento || '',
      distrito: formData.oficina || user.profile?.distrito || '',
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
      const contextualError = new FirestorePermissionError({ path: 'informes-divulgador', operation: 'create', requestResourceData: docData });
      errorEmitter.emit('permission-error', contextualError);
    } finally { setIsSubmitting(false); }
  };

  const generatePDF = async () => { /* ... */ };

  if (isUserLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <Header title="Anexo III" />
      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-4xl mb-6"> {/* ... Agenda Select ... */} </div>

        <Card className="mx-auto max-w-4xl shadow-xl border-t-4 border-t-primary">
          <CardHeader className="bg-primary/5">
            <CardTitle className="flex items-center gap-2"><UserCheck className="h-6 w-6 text-primary" /> Informe Anexo III</CardTitle>
          </CardHeader>
          <CardContent className="space-y-8 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/30 p-6 rounded-xl border-2 border-dashed">
              <div className="space-y-2">
                <Label className="font-black text-primary text-[10px] uppercase">Nombre Completo Divulgador</Label>
                <div className="relative">
                    <Input 
                        name="nombre_divulgador"
                        value={formData.nombre_divulgador} 
                        onChange={handleInputChange}
                        readOnly={padronFound}
                        className={cn(padronFound && "bg-green-50 border-green-300 font-bold text-green-900")}
                    />
                    {padronFound && (
                        <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={clearDivulgadorData}>
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-black text-primary text-[10px] uppercase">C.I.C. N.º</Label>
                  <div className="relative">
                    <Input 
                        name="cedula_divulgador" 
                        value={formData.cedula_divulgador} 
                        onChange={handleCedulaDivulgadorChange} 
                        disabled={isSearchingCedula}
                    />
                    {isSearchingCedula && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="font-black text-primary text-[10px] uppercase">Vínculo</Label>
                  <Input name="vinculo" value={formData.vinculo} onChange={handleInputChange} />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="font-black text-primary text-[10px] uppercase">Oficina</Label>
                <Input name="oficina" value={formData.oficina} onChange={handleInputChange} />
              </div>
              <div className="space-y-2">
                <Label className="font-black text-primary text-[10px] uppercase">Departamento</Label>
                <Input name="departamento" value={formData.departamento} onChange={handleInputChange} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6"> {/* ... Lugar y Fecha ... */} </div>

            <div className="space-y-4">
                <Label className="font-bold">MARCA CON UNA \"X\" POR CADA CIUDADANO QUE PRACTICÓ</Label>
                <div className="grid grid-cols-6 sm:grid-cols-10 md:grid-cols-13 border rounded-lg overflow-hidden bg-background">
                    {Array.from({ length: 104 }, (_, i) => i + 1).map(num => (
                        <div key={num} onClick={() => toggleCell(num)} className={cn("aspect-square border flex flex-col items-center justify-center cursor-pointer hover:bg-primary/5", markedCells.includes(num) ? "bg-primary/10" : "")}>
                            <span className="text-[10px] text-muted-foreground">{num}</span>
                            <span className="text-xl font-black text-primary">{markedCells.includes(num) ? "X" : ""}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="space-y-6"> {/* ... Fotos de Evento ... */} </div>
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row gap-4 border-t p-6 bg-muted/5">
            {/* ... Botones de Acción ... */}
          </CardFooter>
        </Card>
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
