
"use client";

import { useState, useMemo, useEffect } from 'react';
import Header from '@/components/header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { UserPlus, Users, Loader2, Edit, Trash2, Search, AlertCircle, UserCircle, MapPin, Landmark, Navigation } from 'lucide-react';
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
  const [selectedDist, setSelectedDist] = useState<string>('');

  const profile = currentUser?.profile;

  // Permisos jerárquicos
  const hasAdminFilter = useMemo(() => 
    ['admin', 'director'].includes(profile?.role || '') || profile?.permissions?.includes('admin_filter'),
    [profile]
  );
  
  const hasDeptFilter = useMemo(() => 
    !hasAdminFilter && profile?.permissions?.includes('department_filter'),
    [profile, hasAdminFilter]
  );

  const hasDistFilter = useMemo(() => 
    !hasAdminFilter && !hasDeptFilter && (profile?.permissions?.includes('district_filter') || profile?.role === 'jefe' || profile?.role === 'funcionario'),
    [profile, hasAdminFilter, hasDeptFilter]
  );

  // Sincronizar jurisdicción del perfil al cargar
  useEffect(() => {
    if (profile) {
      if (hasDeptFilter || hasDistFilter) {
        setSelectedDept(profile.departamento || '');
      }
      if (hasDistFilter) {
        setSelectedDist(profile.distrito || '');
      }
    }
  }, [profile, hasDeptFilter, hasDistFilter]);

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
    if (!firestore || isUserLoading || !currentUser?.uid || !profile) return null;
    const colRef = collection(firestore, 'divulgadores');
    
    if (hasAdminFilter) return colRef; // Listado total para admins/directores
    
    if (hasDeptFilter && profile.departamento) {
        return query(colRef, where('departamento', '==', profile.departamento));
    }

    if (hasDistFilter && profile.departamento && profile.distrito) {
        return query(
          colRef, 
          where('departamento', '==', profile.departamento), 
          where('distrito', '==', profile.distrito)
        );
    }
    
    return null;
  }, [firestore, currentUser, isUserLoading, profile, hasAdminFilter, hasDeptFilter, hasDistFilter]);

  const { data: rawDivulgadores, isLoading: isLoadingDivul } = useCollection<Divulgador>(divulQuery);

  const divulgadores = useMemo(() => {
    if (!rawDivulgadores) return null;
    return [...rawDivulgadores].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [rawDivulgadores]);

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
    if (!firestore || !profile) return;
    
    const finalDept = hasAdminFilter ? selectedDept : (profile.departamento || '');
    const finalDist = (hasAdminFilter || hasDeptFilter) ? selectedDist : (profile.distrito || '');

    if (!finalDept || !finalDist) {
      toast({ variant: 'destructive', title: "Faltan datos", description: "Seleccione la jurisdicción correspondiente." });
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const docData = {
      nombre: (formData.get('nombre') as string).toUpperCase(),
      cedula: formData.get('cedula') as string,
      vinculo: formData.get('vinculo') as any,
      departamento: finalDept,
      distrito: finalDist,
      fecha_registro: new Date().toISOString()
    };

    try {
      await addDoc(collection(firestore, 'divulgadores'), docData);
      toast({ title: "¡Registrado!", description: `${docData.nombre} ha sido añadido al directorio.` });
      (e.target as HTMLFormElement).reset();
      if (hasAdminFilter) {
        setSelectedDept('');
        setSelectedDist('');
      } else if (hasDeptFilter) {
        setSelectedDist('');
      }
    } catch (err) {
      toast({ variant: 'destructive', title: "Error", description: "No se pudo registrar al divulgador." });
    } finally { setIsSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'divulgadores', id));
      toast({ title: "Eliminado", description: "El registro ha sido removido." });
    } catch (err) {
      toast({ variant: 'destructive', title: "Error" });
    }
  };

  if (isUserLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  return (
    <div className="flex min-h-screen flex-col bg-muted/5">
      <Header title="Directorio de Divulgadores" />
      <main className="flex-1 p-4 md:p-8 max-7xl mx-auto w-full space-y-8">
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight uppercase text-primary">Personal Operativo</h1>
            <p className="text-muted-foreground flex items-center gap-2 mt-1 text-sm font-medium">
              <UserCircle className="h-4 w-4" />
              Gestión de divulgadores para capacitaciones del CIDEE.
            </p>
          </div>
        </div>

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
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nombre Completo</Label>
                  <Input name="nombre" required className="font-bold uppercase h-11 border-2" placeholder="EJ: JUAN PEREZ" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cédula de Identidad</Label>
                  <Input name="cedula" required className="font-black h-11 border-2" placeholder="Sin puntos" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Vínculo Laboral</Label>
                  <Select name="vinculo" required defaultValue="CONTRATADO">
                    <SelectTrigger className="font-bold h-11 border-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERMANENTE" className="font-bold">PERMANENTE</SelectItem>
                      <SelectItem value="CONTRATADO" className="font-bold">CONTRATADO</SelectItem>
                      <SelectItem value="COMISIONADO" className="font-bold">COMISIONADO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-1 gap-4 pt-2">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase flex items-center gap-1.5 text-primary">
                      <Landmark className="h-3 w-3"/> Departamento {(!hasAdminFilter) && "(Fijo)"}
                    </Label>
                    {hasAdminFilter ? (
                      <Select name="departamento" required onValueChange={setSelectedDept} value={selectedDept}>
                        <SelectTrigger className="font-bold h-11 border-2"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                        <SelectContent>{departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : (
                      <div className="h-11 flex items-center px-3 font-black uppercase text-sm bg-muted/50 border-2 rounded-md text-primary/70">
                        {profile?.departamento}
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase flex items-center gap-1.5 text-primary">
                      <Navigation className="h-3 w-3"/> Distrito {hasDistFilter && "(Fijo)"}
                    </Label>
                    {hasDistFilter ? (
                      <div className="h-11 flex items-center px-3 font-black uppercase text-sm bg-muted/50 border-2 rounded-md text-primary/70">
                        {profile?.distrito}
                      </div>
                    ) : (
                      <Select name="distrito" required onValueChange={setSelectedDist} value={selectedDist} disabled={!selectedDept && hasAdminFilter}>
                        <SelectTrigger className="font-bold h-11 border-2"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                        <SelectContent>{districts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="bg-muted/30 border-t p-4">
                <Button type="submit" className="w-full font-black uppercase h-12 shadow-lg text-xs" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : "GUARDAR PERSONAL"}
                </Button>
              </CardFooter>
            </form>
          </Card>

          <Card className="lg:col-span-2 shadow-lg overflow-hidden border-none">
            <CardHeader className="flex flex-row items-center justify-between bg-primary px-6 py-4">
              <CardTitle className="uppercase font-black text-xs flex items-center gap-2 text-white tracking-widest">
                <Users className="h-4 w-4" /> LISTA DE PERSONAL ({filteredDivul.length})
              </CardTitle>
              <div className="relative w-64 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/50 group-focus-within:text-white" />
                <Input 
                  placeholder="Buscar por nombre o CI..." 
                  className="pl-9 h-9 text-[10px] font-bold bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:bg-white focus:text-primary transition-all" 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                />
              </div>
            </CardHeader>
            <CardContent className="p-0 bg-white">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow className="hover:bg-transparent border-b-2">
                      <TableHead className="text-[9px] font-black uppercase tracking-widest px-6 py-4">Divulgador</TableHead>
                      <TableHead className="text-[9px] font-black uppercase tracking-widest px-6 py-4">Jurisdicción</TableHead>
                      <TableHead className="text-[9px] font-black uppercase tracking-widest px-6 py-4">Vínculo</TableHead>
                      <TableHead className="text-right text-[9px] font-black uppercase tracking-widest px-6 py-4">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingDivul ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-20"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary opacity-20" /></TableCell></TableRow>
                    ) : filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-24">
                          <Users className="h-12 w-12 mx-auto text-muted-foreground opacity-10 mb-4" />
                          <p className="text-muted-foreground font-black uppercase text-[10px] tracking-widest">No hay personal registrado en esta zona.</p>
                        </TableCell>
                      </TableRow>
                    ) : filteredDivul.map(d => (
                      <TableRow key={d.id} className="hover:bg-primary/5 transition-colors border-b">
                        <TableCell className="py-4 px-6">
                          <p className="font-black text-xs uppercase text-primary leading-none mb-1">{d.nombre}</p>
                          <p className="text-[9px] text-muted-foreground font-black tracking-tighter">C.I. {d.cedula}</p>
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          <p className="text-[10px] font-black uppercase text-primary leading-tight">{d.departamento}</p>
                          <p className="text-[9px] font-bold text-muted-foreground uppercase">{d.distrito}</p>
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          <Badge variant="secondary" className="text-[8px] font-black uppercase px-2.5 py-0.5 rounded-full bg-primary/5 text-primary border-none">{d.vinculo}</Badge>
                        </TableCell>
                        <TableCell className="text-right px-6">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/40 hover:text-destructive hover:bg-destructive/10 rounded-full transition-all">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="font-black uppercase text-primary">¿Eliminar registro?</AlertDialogTitle>
                                <AlertDialogDescription className="font-medium text-xs">
                                  Esta acción removerá a <strong className="text-primary">{d.nombre}</strong> del directorio institucional de forma permanente.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="mt-4">
                                <AlertDialogCancel className="font-bold text-[10px] uppercase rounded-xl">Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(d.id)} className="bg-destructive text-white font-black text-[10px] uppercase rounded-xl shadow-lg">Eliminar Permanente</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
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
