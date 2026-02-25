
"use client";

import { useState, useEffect, useMemo } from 'react';
import Header from '@/components/header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  UserPlus, 
  Users, 
  Loader2, 
  Edit, 
  Trash2, 
  Search, 
  ShieldCheck, 
  ShieldAlert, 
  MapPin, 
  Globe, 
  CheckCircle2,
  Lock,
  Settings2,
  Settings,
  ChevronRight
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useFirebase, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { collection, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
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
import { type Dato } from '@/lib/data';
import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import { cn } from '@/lib/utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

type UserProfile = {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'director' | 'jefe' | 'funcionario' | 'viewer';
  modules: string[];
  permissions: string[];
  departamento?: string;
  distrito?: string;
};

const MODULE_CATEGORIES = [
  {
    label: "CIDEE - CAPACITACIONES",
    items: [
      { id: 'solicitud-capacitacion', label: 'ANEXO V (SOLICITUDES)' },
      { id: 'divulgadores', label: 'DIRECTORIO DIVULGADORES' },
      { id: 'agenda-capacitacion', label: 'AGENDA DE ACTIVIDADES' },
      { id: 'control-movimiento-maquinas', label: 'MOVIMIENTO MÁQUINAS' },
      { id: 'denuncia-lacres', label: 'DENUNCIA DE LACRES' },
      { id: 'encuesta-satisfaccion', label: 'ENCUESTA SATISFACCIÓN' },
      { id: 'informe-divulgador', label: 'ANEXO III (INFORMES)' },
      { id: 'informe-semanal-puntos-fijos', label: 'ANEXO IV (SEMANAL)' },
      { id: 'estadisticas-capacitacion', label: 'ESTADÍSTICAS CIDEE' },
    ]
  },
  {
    label: "REGISTROS ELECTORALES",
    items: [
      { id: 'ficha', label: 'VISTA DE FICHA (EDILICIO)' },
      { id: 'fotos', label: 'GALERÍA FOTOGRÁFICA' },
      { id: 'cargar-ficha', label: 'CARGAR FICHA DISTRITAL' },
    ]
  },
  {
    label: "ANÁLISIS Y REPORTES",
    items: [
      { id: 'resumen', label: 'RESUMEN UBICACIONES' },
      { id: 'informe-general', label: 'INFORME GENERAL PDF' },
    ]
  },
  {
    label: "LOCALES DE VOTACIÓN",
    items: [
      { id: 'locales-votacion', label: 'BUSCADOR DE LOCALES' },
      { id: 'cargar-fotos-locales', label: 'CARGA MASIVA FOTOS' },
    ]
  },
  {
    label: "GESTIÓN DE DATOS",
    items: [
      { id: 'importar-reportes', label: 'IMPORTAR REPORTES EXCEL' },
      { id: 'importar-locales', label: 'IMPORTAR LOCALES EXCEL' },
      { id: 'importar-partidos', label: 'IMPORTAR PARTIDOS EXCEL' },
    ]
  },
  {
    label: "SISTEMA",
    items: [
      { id: 'users', label: 'GESTIÓN USUARIOS' },
      { id: 'settings', label: 'CONFIGURACIÓN MAESTRA' },
      { id: 'documentacion', label: 'DOCUMENTACIÓN SISTEMA' },
    ]
  }
];

const PERMISSION_LIST = [
  { id: 'admin_filter', label: 'FILTRO NACIONAL (VER TODO)' },
  { id: 'department_filter', label: 'FILTRO DEPARTAMENTAL' },
  { id: 'district_filter', label: 'FILTRO DISTRITAL' },
  { id: 'assign_staff', label: 'ASIGNAR PERSONAL EN AGENDA' },
  { id: 'generar_pdf', label: 'GENERAR DOCUMENTOS PDF' },
  { id: 'ficha:edit', label: 'EDITAR DATOS EDILICIOS' },
  { id: 'ficha:delete', label: 'BORRAR IMÁGENES/DATOS' },
];

export default function UsersPage() {
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const { user: currentUser, isUserLoading: isMeLoading } = useUser();

  const usersQuery = useMemoFirebase(() => (firestore && currentUser?.profile?.role === 'admin' ? collection(firestore, 'users') : null), [firestore, currentUser]);
  const { data: users, isLoading: isLoadingUsers } = useCollection<UserProfile>(usersQuery);
  const datosQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'datos') : null), [firestore]);
  const { data: datosData } = useCollection<Dato>(datosQuery);

  const [searchTerm, setSearchTerm] = useState('');
  const [regDepartamento, setRegDepartamento] = useState<string>('');
  const [regDistrito, setRegDistrito] = useState<string>('');
  const [regRole, setRegRole] = useState<UserProfile['role']>('viewer');
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set());
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());

  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const departments = useMemo(() => {
    if (!datosData) return [];
    return [...new Set(datosData.map(d => d.departamento))].sort();
  }, [datosData]);

  const districts = useMemo(() => {
    if (!datosData || !regDepartamento) return [];
    return [...new Set(datosData.filter(d => d.departamento === regDepartamento).map(d => d.distrito))].sort();
  }, [datosData, regDepartamento]);

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    const term = searchTerm.toLowerCase().trim();
    return users.filter(u => 
      u.username.toLowerCase().includes(term) || 
      u.email.toLowerCase().includes(term) || 
      u.role.toLowerCase().includes(term)
    ).sort((a,b) => a.username.localeCompare(b.username));
  }, [users, searchTerm]);

  const handleToggleModule = (moduleId: string) => {
    setSelectedModules(prev => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

  const handleTogglePerm = (permId: string) => {
    setSelectedPerms(prev => {
      const next = new Set(prev);
      if (next.has(permId)) next.delete(permId);
      else next.add(permId);
      return next;
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!firestore || !currentUser) return;

    if (selectedModules.size === 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Debe seleccionar al menos un módulo.' });
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData(form);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const username = formData.get('username') as string;

    const newUserProfile: Omit<UserProfile, 'id'> = { 
      username: username.toUpperCase(), 
      email, 
      role: regRole, 
      modules: Array.from(selectedModules), 
      permissions: Array.from(selectedPerms), 
      departamento: regDepartamento || '', 
      distrito: regDistrito || ''
    };

    const tempAppName = 'temp-creation-' + Math.random().toString(36).substring(7);
    let tempApp: FirebaseApp | undefined = undefined;

    try {
      tempApp = initializeApp(firebaseConfig, tempAppName);
      const tempAuth = getAuth(tempApp);
      const userCredential = await createUserWithEmailAndPassword(tempAuth, email, password);
      
      const docRef = doc(firestore, 'users', userCredential.user.uid);
      await setDoc(docRef, newUserProfile);
      
      await signOut(tempAuth);
      toast({ title: 'Usuario Creado con éxito' });
      form.reset();
      setSelectedModules(new Set());
      setSelectedPerms(new Set());
      setRegDepartamento('');
      setRegDistrito('');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error de Creación', description: error.message });
    } finally {
      if (tempApp) await deleteApp(tempApp);
      setIsSubmitting(false);
    }
  };

  const handleOpenEdit = (user: UserProfile) => {
    setEditingUser({ ...user });
    setEditModalOpen(true);
  };

  const handleUpdateUser = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firestore || !editingUser) return;
    setIsSubmitting(true);
    
    const updateData = { 
      role: editingUser.role, 
      modules: editingUser.modules || [], 
      permissions: editingUser.permissions || [],
      departamento: editingUser.departamento || '',
      distrito: editingUser.distrito || ''
    };
    
    const docRef = doc(firestore, 'users', editingUser.id);
    
    updateDoc(docRef, updateData)
      .then(() => {
        toast({ title: 'Perfil Actualizado' });
        setEditModalOpen(false);
        setIsSubmitting(false);
      })
      .catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'update', requestResourceData: updateData }));
        setIsSubmitting(false);
      });
  };

  const handleDeleteUser = (userId: string) => {
    if (!firestore) return;
    const docRef = doc(firestore, 'users', userId);
    deleteDoc(docRef).catch(async () => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'delete' }));
    });
  };

  if (isMeLoading || isLoadingUsers) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary"/></div>;

  return (
    <div className="flex min-h-screen flex-col bg-muted/5">
      <Header title="Gestión de Usuarios y Permisos" />
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-8">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 className="text-3xl font-black tracking-tight uppercase text-primary leading-none">Control de Personal</h1>
                <p className="text-muted-foreground text-[10px] font-bold uppercase flex items-center gap-2 mt-2 tracking-widest">
                    <Lock className="h-3 w-3" /> Matriz de Seguridad y Accesos Institucionales
                </p>
            </div>
            <Badge className="bg-primary text-white font-black px-4 py-1 uppercase text-[9px] tracking-[0.2em] h-7">ADMINISTRADOR NACIONAL</Badge>
        </div>

        <Card className="border-t-8 border-t-primary shadow-2xl overflow-hidden border-none">
          <form onSubmit={handleSubmit}>
            <CardHeader className="bg-muted/30 border-b py-4">
              <CardTitle className="uppercase font-black text-xs flex items-center gap-2 tracking-widest">
                <UserPlus className="h-4 w-4" /> REGISTRAR NUEVO FUNCIONARIO
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-8 pt-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-wider">Nombre Completo</Label>
                    <Input name="username" placeholder="NOMBRE Y APELLIDO" required className="font-bold uppercase h-11 border-2 focus-visible:ring-primary" />
                </div>
                <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-wider">Correo Institucional</Label>
                    <Input name="email" type="email" placeholder="usuario@tsje.gov.py" required className="font-bold h-11 border-2 focus-visible:ring-primary" />
                </div>
                <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-wider">Contraseña Provisoria</Label>
                    <Input name="password" type="password" placeholder="Mínimo 6 caracteres" required className="font-bold h-11 border-2 focus-visible:ring-primary" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase text-primary tracking-wider">Rol Institucional</Label>
                    <Select onValueChange={(v: any) => setRegRole(v)} value={regRole}>
                        <SelectTrigger className="font-black h-11 border-2 uppercase text-[10px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="admin" className="font-black text-[10px]">ADMINISTRADOR</SelectItem>
                            <SelectItem value="director" className="font-black text-[10px]">DIRECTOR</SelectItem>
                            <SelectItem value="jefe" className="font-black text-[10px]">JEFE DE OFICINA</SelectItem>
                            <SelectItem value="funcionario" className="font-black text-[10px]">FUNCIONARIO</SelectItem>
                            <SelectItem value="viewer" className="font-black text-[10px]">SOLO LECTURA</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-wider">Departamento Asignado</Label>
                    <Select onValueChange={setRegDepartamento} value={regDepartamento}>
                        <SelectTrigger className="font-black h-11 border-2 uppercase text-[10px]"><SelectValue placeholder="Elegir..." /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="N/A" className="font-black text-[10px]">ALCANCE NACIONAL</SelectItem>
                            {departments.map(d => <SelectItem key={d} value={d} className="font-black text-[10px]">{d}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-wider">Distrito Asignado</Label>
                    <Select onValueChange={setRegDistrito} value={regDistrito} disabled={!regDepartamento}>
                        <SelectTrigger className="font-black h-11 border-2 uppercase text-[10px]"><SelectValue placeholder="Elegir..." /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="N/A" className="font-black text-[10px]">TODOS LOS DISTRITOS</SelectItem>
                            {districts.map(d => <SelectItem key={d} value={d} className="font-black text-[10px]">{d}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div className="space-y-4">
                    <Label className="text-xs font-black uppercase text-primary flex items-center gap-2 tracking-widest">
                        <Settings2 className="h-4 w-4" /> MÓDULOS HABILITADOS
                    </Label>
                    <div className="p-4 bg-white rounded-xl border-2 border-dashed border-muted-foreground/20">
                        <Accordion type="multiple" className="space-y-2">
                            {MODULE_CATEGORIES.map((cat) => (
                                <AccordionItem key={cat.label} value={cat.label} className="border rounded-lg px-4 bg-muted/5">
                                    <AccordionTrigger className="hover:no-underline py-3">
                                        <span className="text-[10px] font-black uppercase tracking-wider">{cat.label}</span>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="grid grid-cols-1 gap-3 pt-2 pb-4">
                                            {cat.items.map(mod => (
                                                <div key={mod.id} className="flex items-center space-x-3 group">
                                                    <Checkbox 
                                                        id={`mod-${mod.id}`} 
                                                        checked={selectedModules.has(mod.id)} 
                                                        onCheckedChange={() => handleToggleModule(mod.id)} 
                                                        className="border-primary data-[state=checked]:bg-primary"
                                                    />
                                                    <Label htmlFor={`mod-${mod.id}`} className="text-[9px] font-black uppercase cursor-pointer group-hover:text-primary transition-colors">{mod.label}</Label>
                                                </div>
                                            ))}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </div>
                </div>
                
                <div className="space-y-4">
                    <Label className="text-xs font-black uppercase text-primary flex items-center gap-2 tracking-widest">
                        <ShieldCheck className="h-4 w-4" /> PERMISOS ESPECIALES
                    </Label>
                    <div className="p-6 bg-muted/30 rounded-xl border-2 border-primary/5 min-h-[300px]">
                        <div className="grid grid-cols-1 gap-4">
                            {PERMISSION_LIST.map(p => (
                                <div key={p.id} className={cn(
                                    "flex items-center space-x-4 p-3 rounded-lg border-2 transition-all group",
                                    selectedPerms.has(p.id) ? "bg-white border-primary shadow-sm" : "bg-transparent border-transparent grayscale opacity-60"
                                )}>
                                    <Checkbox 
                                        id={`perm-${p.id}`} 
                                        checked={selectedPerms.has(p.id)} 
                                        onCheckedChange={() => handleTogglePerm(p.id)} 
                                        className="h-5 w-5"
                                    />
                                    <Label htmlFor={`perm-${p.id}`} className="text-[10px] font-black uppercase cursor-pointer tracking-wider flex-1">{p.label}</Label>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/30 border-t p-6">
              <Button type="submit" className="w-full h-16 font-black uppercase shadow-xl text-lg tracking-[0.1em]" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin mr-3 h-6 w-6" /> : <UserPlus className="mr-3 h-6 w-6" />}
                FINALIZAR REGISTRO INSTITUCIONAL
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Card className="shadow-2xl overflow-hidden border-none rounded-xl">
            <CardHeader className="bg-primary text-white py-5 px-8 flex flex-row items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="h-10 w-10 bg-white/10 rounded-xl flex items-center justify-center">
                        <Users className="h-6 w-6" />
                    </div>
                    <div>
                        <CardTitle className="uppercase font-black text-sm tracking-[0.2em]">DIRECTORIO DE PERSONAL</CardTitle>
                        <CardDescription className="text-white/60 text-[9px] font-black uppercase tracking-widest mt-1">Total: {filteredUsers.length} funcionarios activos</CardDescription>
                    </div>
                </div>
                <div className="relative w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                    <Input 
                        placeholder="Buscar por nombre o correo..." 
                        className="h-10 pl-10 text-[10px] font-bold bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-white/20 focus-visible:bg-white/10 transition-all rounded-full"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </CardHeader>
            <CardContent className="p-0 bg-white">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow className="border-b-2">
                            <TableHead className="text-[9px] font-black uppercase tracking-widest px-8">Funcionario</TableHead>
                            <TableHead className="text-[9px] font-black uppercase tracking-widest">Rol y Acceso</TableHead>
                            <TableHead className="text-[9px] font-black uppercase tracking-widest">Jurisdicción</TableHead>
                            <TableHead className="text-right text-[9px] font-black uppercase tracking-widest px-8">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredUsers.map(user => (
                            <TableRow key={user.id} className="hover:bg-primary/5 transition-colors border-b group">
                                <TableCell className="py-5 px-8">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-primary/5 flex items-center justify-center text-primary font-black text-[10px] border border-primary/10">
                                            {user.username.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-black text-xs uppercase text-primary leading-tight">{user.username}</p>
                                            <p className="text-[9px] font-bold text-muted-foreground uppercase mt-0.5">{user.email}</p>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col gap-1.5">
                                        <Badge variant="outline" className="w-fit text-[8px] font-black uppercase border-primary/20 bg-primary/5 text-primary">
                                            {user.role}
                                        </Badge>
                                        <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest ml-1">{user.modules?.length || 0} MÓDULOS ACTIVOS</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-black uppercase flex items-center gap-1.5 text-foreground/80">
                                            <Globe className="h-3 w-3 text-primary opacity-40" /> {user.departamento || 'ALCANCE NACIONAL'}
                                        </p>
                                        {user.distrito && user.distrito !== 'N/A' && (
                                            <p className="text-[8px] font-bold text-muted-foreground uppercase flex items-center gap-1.5 ml-4">
                                                <MapPin className="h-2.5 w-2.5" /> {user.distrito}
                                            </p>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right px-8">
                                    <div className="flex justify-end gap-3">
                                        <Button variant="outline" size="icon" className="h-9 w-9 rounded-full border-primary/10 hover:bg-primary hover:text-white transition-all shadow-sm" onClick={() => handleOpenEdit(user)}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="outline" size="icon" className="h-9 w-9 rounded-full border-destructive/10 text-destructive/60 hover:bg-destructive hover:text-white transition-all shadow-sm">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent className="rounded-2xl border-none shadow-2xl">
                                                <AlertDialogHeader>
                                                    <div className="h-12 w-12 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                                        <ShieldAlert className="h-6 w-6 text-destructive" />
                                                    </div>
                                                    <AlertDialogTitle className="font-black uppercase text-center text-lg">¿ELIMINAR ACCESO?</AlertDialogTitle>
                                                    <AlertDialogDescription className="text-[10px] font-bold uppercase text-center tracking-widest text-muted-foreground">
                                                        Esta acción revocará todos los permisos de <strong>{user.username}</strong> de forma permanente en el sistema central.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter className="mt-6 flex gap-2">
                                                    <AlertDialogCancel className="font-black text-[10px] uppercase rounded-full h-11 flex-1">CANCELAR</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteUser(user.id)} className="bg-destructive text-white font-black text-[10px] uppercase rounded-full h-11 flex-1 shadow-lg shadow-destructive/20">ELIMINAR DEFINITIVAMENTE</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
      </main>

      {/* MODAL DE EDICIÓN AVANZADA */}
      <Dialog open={isEditModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-5xl max-h-[95vh] flex flex-col p-0 border-none shadow-2xl overflow-hidden rounded-3xl">
          {editingUser && (
            <form onSubmit={handleUpdateUser} className="flex flex-col h-full bg-white">
              <DialogHeader className="p-8 bg-primary text-white shrink-0">
                <div className="flex items-center gap-4">
                    <div className="h-14 w-14 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20">
                        <Settings className="h-8 w-8" />
                    </div>
                    <div>
                        <DialogTitle className="text-2xl font-black uppercase leading-none tracking-tight">Editar Perfil Institucional</DialogTitle>
                        <DialogDescription className="text-white/60 font-bold uppercase text-[10px] tracking-[0.2em] mt-2">
                            Funcionario: {editingUser.username}
                        </DialogDescription>
                    </div>
                </div>
              </DialogHeader>
              
              <ScrollArea className="flex-1 p-8">
                <div className="space-y-10">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Rol del Funcionario</Label>
                            <Select onValueChange={(v: any) => setEditingUser({...editingUser, role: v})} value={editingUser.role}>
                                <SelectTrigger className="font-black h-12 border-2 text-[10px] uppercase"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="admin" className="font-black text-[10px]">ADMINISTRADOR</SelectItem>
                                    <SelectItem value="director" className="font-black text-[10px]">DIRECTOR</SelectItem>
                                    <SelectItem value="jefe" className="font-black text-[10px]">JEFE DE OFICINA</SelectItem>
                                    <SelectItem value="funcionario" className="font-black text-[10px]">FUNCIONARIO</SelectItem>
                                    <SelectItem value="viewer" className="font-black text-[10px]">SOLO LECTURA</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Departamento</Label>
                            <Select onValueChange={(v) => setEditingUser({...editingUser, departamento: v, distrito: ''})} value={editingUser.departamento || 'N/A'}>
                                <SelectTrigger className="font-black h-12 border-2 text-[10px] uppercase"><SelectValue placeholder="Elegir..." /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="N/A" className="font-black text-[10px]">ALCANCE NACIONAL</SelectItem>
                                    {departments.map(d => <SelectItem key={d} value={d} className="font-black text-[10px]">{d}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Distrito</Label>
                            <Select onValueChange={(v) => setEditingUser({...editingUser, distrito: v})} value={editingUser.distrito || 'N/A'} disabled={!editingUser.departamento || editingUser.departamento === 'N/A'}>
                                <SelectTrigger className="font-black h-12 border-2 text-[10px] uppercase"><SelectValue placeholder="Elegir..." /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="N/A" className="font-black text-[10px]">TODOS LOS DISTRITOS</SelectItem>
                                    {datosData?.filter(d => d.departamento === editingUser.departamento).map(d => <SelectItem key={d.distrito} value={d.distrito} className="font-black text-[10px]">{d.distrito}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                        <div className="space-y-5">
                            <Label className="text-sm font-black uppercase text-primary tracking-widest flex items-center gap-2">
                                <ChevronRight className="h-4 w-4 text-primary" /> Módulos Habilitados
                            </Label>
                            <div className="p-2 bg-white rounded-2xl border-2 border-muted-foreground/10">
                                <Accordion type="multiple" className="space-y-2">
                                    {MODULE_CATEGORIES.map((cat) => (
                                        <AccordionItem key={`edit-cat-${cat.label}`} value={cat.label} className="border rounded-xl px-4 bg-muted/5">
                                            <AccordionTrigger className="hover:no-underline py-3">
                                                <span className="text-[10px] font-black uppercase tracking-wider">{cat.label}</span>
                                            </AccordionTrigger>
                                            <AccordionContent>
                                                <div className="grid grid-cols-1 gap-3 pt-2 pb-4">
                                                    {cat.items.map(mod => (
                                                        <div key={`edit-mod-${mod.id}`} className="flex items-center space-x-3 group">
                                                            <Checkbox 
                                                                id={`edit-cb-mod-${mod.id}`} 
                                                                checked={editingUser.modules?.includes(mod.id)} 
                                                                onCheckedChange={(checked) => {
                                                                    const next = checked 
                                                                        ? [...(editingUser.modules || []), mod.id]
                                                                        : (editingUser.modules || []).filter(id => id !== mod.id);
                                                                    setEditingUser({...editingUser, modules: next});
                                                                }} 
                                                                className="h-5 w-5 border-primary data-[state=checked]:bg-primary"
                                                            />
                                                            <Label htmlFor={`edit-cb-mod-${mod.id}`} className="text-[9px] font-black uppercase cursor-pointer group-hover:text-primary">{mod.label}</Label>
                                                        </div>
                                                    ))}
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            </div>
                        </div>
                        
                        <div className="space-y-5">
                            <Label className="text-sm font-black uppercase text-primary tracking-widest flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4" /> Permisos Especiales
                            </Label>
                            <div className="p-6 bg-muted/20 rounded-3xl border-2 border-primary/5">
                                <div className="grid grid-cols-1 gap-4">
                                    {PERMISSION_LIST.map(p => (
                                        <div key={`edit-perm-${p.id}`} className={cn(
                                            "flex items-center space-x-4 p-4 rounded-2xl border-2 transition-all group shadow-sm",
                                            editingUser.permissions?.includes(p.id) ? "bg-white border-primary" : "bg-transparent border-transparent grayscale opacity-40"
                                        )}>
                                            <Checkbox 
                                                id={`edit-cb-perm-${p.id}`} 
                                                checked={editingUser.permissions?.includes(p.id)} 
                                                onCheckedChange={(checked) => {
                                                    const next = checked 
                                                        ? [...(editingUser.permissions || []), p.id]
                                                        : (editingUser.permissions || []).filter(id => id !== p.id);
                                                    setEditingUser({...editingUser, permissions: next});
                                                }} 
                                                className="h-6 w-6"
                                            />
                                            <Label htmlFor={`edit-cb-perm-${p.id}`} className="text-[10px] font-black uppercase cursor-pointer flex-1 tracking-widest">{p.label}</Label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
              </ScrollArea>
              
              <DialogFooter className="p-8 bg-muted/30 border-t flex flex-row gap-4">
                <DialogClose asChild><Button variant="outline" type="button" className="font-black uppercase text-[10px] px-8 h-14 rounded-full border-2">CANCELAR</Button></DialogClose>
                <Button type="submit" disabled={isSubmitting} className="font-black uppercase text-xs px-12 h-14 rounded-full flex-1 shadow-2xl">
                    {isSubmitting ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}
                    ACTUALIZAR PERFIL INSTITUCIONAL
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
