
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { FileUp, Loader2, CheckCircle2, Database, Cpu, Search, Trash } from 'lucide-react';
import Header from '@/components/header';
import * as XLSX from 'xlsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { type Dato, type Department, type District, type MaquinaVotacion } from '@/lib/data';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useFirebase, useMemoFirebase, useUser } from '@/firebase';
import { collection, doc, writeBatch, deleteDoc, query, orderBy } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export default function SettingsPage() {
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const { user: currentUser, isUserLoading } = useUser();

  const [fileNameGeo, setFileNameGeo] = useState<string | null>(null);
  const [isParsingGeo, setIsParsingGeo] = useState(false);
  const [isUploadingGeo, setIsUploadingGeo] = useState(false);
  const [previewGeo, setPreviewGeo] = useState<Dato[]>([]);

  const datosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'datos') : null, [firestore]);
  const { data: datosData, isLoading: isLoadingDatos } = useCollection<Dato>(datosQuery);

  const maquinasQuery = useMemoFirebase(() => {
    if (!firestore || !currentUser) return null;
    return query(collection(firestore, 'maquinas'), orderBy('departamento'), orderBy('distrito'));
  }, [firestore, currentUser]);
  
  const { data: maquinasData, isLoading: isLoadingMaquinas } = useCollection<MaquinaVotacion>(maquinasQuery);

  const departmentsWithDistricts = useMemo(() => {
    if (!datosData) return [];
    const deptsMap: Map<string, Department & { districts: District[] }> = new Map();
    datosData.forEach((dato) => {
      if (!deptsMap.has(dato.departamento)) {
        deptsMap.set(dato.departamento, { id: dato.departamento, name: dato.departamento, districts: [] });
      }
      const dept = deptsMap.get(dato.departamento);
      if (dept && !dept.districts.some(d => d.name === dato.distrito)) {
        dept.districts.push({ id: dato.id!, departmentId: dato.departamento, name: dato.distrito });
      }
    });
    return Array.from(deptsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [datosData]);

  const [maqSearch, setMaqSearch] = useState('');
  const filteredMaquinas = useMemo(() => {
    if (!maquinasData) return [];
    const term = maqSearch.toLowerCase();
    return maquinasData.filter(m => 
      m.codigo.toLowerCase().includes(term) || m.departamento.toLowerCase().includes(term) || m.distrito.toLowerCase().includes(term)
    );
  }, [maquinasData, maqSearch]);

  const handleGeoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsParsingGeo(true);
    setFileNameGeo(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = XLSX.utils.sheet_to_json(XLSX.read(e.target?.result, { type: 'binary' }).Sheets[XLSX.read(e.target?.result, { type: 'binary' }).SheetNames[0]]);
        setPreviewGeo(json.map((row: any) => ({
          departamento: String(row.DEPARTAMENTO || '').trim(),
          distrito: String(row.DISTRITO || '').trim(),
          departamento_codigo: String(row.DEPARTAMENTO_CODIGO || '').trim(),
          distrito_codigo: String(row.DISTRITO_CODIGO || '').trim(),
        })).filter(d => d.departamento && d.distrito));
      } catch (err) { toast({ variant: 'destructive', title: 'Error' }); } finally { setIsParsingGeo(false); }
    };
    reader.readAsBinaryString(file);
  };

  const handleSaveGeo = async () => {
    if (!firestore || previewGeo.length === 0) return;
    setIsUploadingGeo(true);
    try {
      for (let i = 0; i < previewGeo.length; i += 100) {
        const batch = writeBatch(firestore);
        previewGeo.slice(i, i + 100).forEach(item => batch.set(doc(collection(firestore, 'datos')), item));
        await batch.commit(); await delay(500);
      }
      toast({ title: '¡Éxito!' }); setPreviewGeo([]); setFileNameGeo(null);
    } catch (err) { toast({ variant: 'destructive', title: 'Error' }); } finally { setIsUploadingGeo(false); }
  };

  if (isUserLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/5">
      <Header title="Configuración" />
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        <Tabs defaultValue="geografia" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
            <TabsTrigger value="geografia" className="gap-2"><Database className="h-4 w-4" /> Geografía</TabsTrigger>
            <TabsTrigger value="maquinas" className="gap-2"><Cpu className="h-4 w-4" /> Máquinas</TabsTrigger>
          </TabsList>
          <TabsContent value="geografia" className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Importar Geografía</CardTitle></CardHeader>
              <CardContent>
                <div className="border-2 border-dashed rounded-xl p-8 bg-muted/30 text-center">
                  <label htmlFor="geo-up" className="cursor-pointer"><FileUp className="mx-auto h-10 w-10 mb-2" /><span>Seleccionar Excel</span></label>
                  <Input id="geo-up" type="file" className="hidden" accept=".xlsx,.csv" onChange={handleGeoFile} />
                  {fileNameGeo && <p className="mt-2 text-xs font-black">{fileNameGeo}</p>}
                </div>
              </CardContent>
              <CardFooter><Button className="w-full" onClick={handleSaveGeo} disabled={previewGeo.length === 0 || isUploadingGeo}>Guardar Estructura</Button></CardFooter>
            </Card>
            <Card><CardContent><Accordion type="single" collapsible className="w-full">
              {departmentsWithDistricts.map((dept) => (
                <AccordionItem key={dept.id} value={dept.id}><AccordionTrigger className="uppercase">{dept.name}</AccordionTrigger>
                <AccordionContent><div className="grid grid-cols-2 gap-2">{dept.districts.map(d => <Badge key={d.id} variant="outline">{d.name}</Badge>)}</div></AccordionContent></AccordionItem>
              ))}
            </Accordion></CardContent></Card>
          </TabsContent>
          <TabsContent value="maquinas" className="space-y-6">
            <Card><CardHeader><div className="flex justify-between items-center"><CardTitle>Inventario</CardTitle><Input placeholder="Buscar..." className="max-w-xs" value={maqSearch} onChange={e => setMaqSearch(e.target.value)} /></div></CardHeader>
            <CardContent><div className="border rounded-lg"><Table><TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Dpto.</TableHead><TableHead>Distrito</TableHead></TableRow></TableHeader>
            <TableBody>{filteredMaquinas.map(m => <TableRow key={m.id}><TableCell className="font-bold">{m.codigo}</TableCell><TableCell>{m.departamento}</TableCell><TableCell>{m.distrito}</TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
