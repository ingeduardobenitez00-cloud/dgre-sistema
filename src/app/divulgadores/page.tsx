
"use client";

import { useState, useMemo } from 'react';
import Header from '@/components/header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { UserPlus, Users, Loader2, Edit, Trash2, Search, AlertCircle, UserCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirebase, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc, query, where, orderBy } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { type Dato, type Divulgador } from '@/lib/data';

export default function DivulgadoresPage() {
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const { user: currentUser, isUserLoading } = useUser();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [editingDivulgador, setEditingDivulgador] = useState<Divulgador | null>(null);

  const datosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'datos') : null, [firestore]);
  const { data: datosData } = useCollection<Dato>(datosQuery);

  const departments = useMemo(() => {
    if (!datosData) return [];
    return [...new Set(datosData.map(d => d.departamento))].sort();
  }, [datosData]);

  const districts = useMemo(() => {
    if (!datosData || !selectedDept) return [];
    return [...new Set(datosData.filter(d => d.departamento === selectedDept).map(d => d.distrito))].sort();
  }, [datosData, selectedDept]);

  const divulQuery = useMemoFirebase(() => {
    if (!firestore || isUserLoading || !currentUser?.uid || !currentUser?.profile) return null;
    const colRef = collection(firestore, 'divulgadores');
    const profile = currentUser.profile;
    if (profile.role === 'admin' || profile.permissions?.includes('admin_filter')) {
      return query(colRef, orderBy('nombre'));
    }
    if (profile.distrito) {
        return query(colRef, where('distrito', '==', profile.distrito), orderBy('nombre'));
    }
    return query(colRef, orderBy('nombre'));
  }, [firestore, currentUser, isUserLoading]);

  const { data: divulgadores, isLoading: isLoadingDivul } = useCollection<Divulgador>(divulQuery);

  const filteredDivul = useMemo(() => {
    if (!divulgadores) return [];
    const term = searchTerm.toLowerCase().trim();
    return divulgadores.filter(d => 
      d.nombre.toLowerCase().includes(term) || 
      d.cedula.includes(term)
    );
  }, [divulgadores, searchTerm]);

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore) return;
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const docData = {
      nombre: (formData.get('nombre') as string).toUpperCase(),
      cedula: formData.get('cedula') as string,
      vinculo: formData.get('vinculo') as any,
      departamento: formData.get('departamento') as string,
      distrito: formData.get('distrito') as string,
      fecha_registro: new Date().toISOString()
    };
    try {
      await addDoc(collection(firestore, 'divulgadores'), docData);
      toast({ title: "¡Registrado!" });
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      toast({ variant: 'destructive', title: "Error" });
    } finally { setIsSubmitting(false); }
  };

  if (isUserLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  return (
    <div className="flex min-h-screen flex-col bg-muted/5">
      <Header title="Directorio de Divulgadores" />
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-1 border-t-4 border-t-primary shadow-lg h-fit">
            <form onSubmit={handleRegister}>
              <CardHeader className="bg-muted/30 border-b">
                <CardTitle className="uppercase font-black text-sm flex items-center gap-2">
                  <UserPlus className="h-4 w-4" /> Nuevo Divulgador
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Nombre Completo</Label>
                  <Input name="nombre" required className="font-bold uppercase" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Cédula</Label>
                  <Input name="cedula" required className="font-bold" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Vínculo</Label>
                  <Select name="vinculo" required defaultValue="CONTRATADO">
                    <SelectTrigger className="font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERMANENTE">PERMANENTE</SelectItem>
                      <SelectItem value="CONTRATADO">CONTRATADO</SelectItem>
                      <SelectItem value="COMISIONADO">COMISIONADO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Departamento</Label>
                  <Select name="departamento" required onValueChange={setSelectedDept}>
                    <SelectTrigger className="font-bold"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                    <SelectContent>{departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Distrito</Label>
                  <Select name="distrito" required disabled={!selectedDept}>
                    <SelectTrigger className="font-bold"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                    <SelectContent>{districts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </CardContent>
              <CardFooter className="bg-muted/30 border-t p-4">
                <Button type="submit" className="w-full font-black uppercase text-xs" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : "GUARDAR"}
                </Button>
              </CardFooter>
            </form>
          </Card>

          <Card className="lg:col-span-2 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="uppercase font-black text-sm flex items-center gap-2"><Users className="h-4 w-4" /> Directorio</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Buscar..." className="pl-9 h-9 text-[10px] font-bold" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
            </CardHeader>
            <CardContent className="p-0 border-t">
                <Table>
                  <TableHeader><TableRow>
                      <TableHead className="text-[9px] font-black uppercase">Divulgador</TableHead>
                      <TableHead className="text-[9px] font-black uppercase">Jurisdicción</TableHead>
                      <TableHead className="text-[9px] font-black uppercase">Vínculo</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {isLoadingDivul ? (
                      <TableRow><TableCell colSpan={3} className="text-center py-10"><Loader2 className="animate-spin h-6 w-6 mx-auto text-primary" /></TableCell></TableRow>
                    ) : filteredDivul.map(d => (
                      <TableRow key={d.id} className="hover:bg-primary/5 transition-colors">
                        <TableCell className="py-3">
                          <p className="font-black text-xs uppercase">{d.nombre}</p>
                          <p className="text-[9px] text-muted-foreground font-bold">C.I. {d.cedula}</p>
                        </TableCell>
                        <TableCell className="py-3">
                          <p className="text-[10px] font-black uppercase text-primary">{d.departamento}</p>
                          <p className="text-[9px] font-bold">{d.distrito}</p>
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge variant="secondary" className="text-[8px] font-black uppercase">{d.vinculo}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
