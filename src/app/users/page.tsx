
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
  Settings2
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

const MODULE_LIST = [
  { id: 'solicitud-capacitacion', label: 'Anexo V (Solicitudes)' },
  { id: 'divulgadores', label: 'Directorio Divulgadores' },
  { id: 'agenda-capacitacion', label: 'Agenda de Actividades' },
  { id: 'control-movimiento-maquinas', label: 'Movimiento Máquinas' },
  { id: 'denuncia-lacres', label: 'Denuncia de Lacres' },
  { id: 'encuesta-satisfaccion', label: 'Encuesta Satisfacción' },
  { id: 'informe-divulgador', label: 'Anexo III (Informes)' },
  { id: 'informe-semanal-puntos-fijos', label: 'Anexo IV (Semanal)' },
  { id: 'estadisticas-capacitacion', label: 'Estadísticas CIDEE' },
  { id: 'ficha', label: 'Vista de Ficha (Edilicio)' },
  { id: 'fotos', label: 'Galería Fotográfica' },
  { id: 'cargar-ficha', label: 'Cargar Ficha Distrital' },
  { id: 'resumen', label: 'Resumen Ubicaciones' },
  { id: 'informe-general', label: 'Informe General PDF' },
  { id: 'locales-votacion', label: 'Buscador de Locales' },
  { id: 'cargar-fotos-locales', label: 'Carga Masiva Fotos' },
  { id: 'importar-reportes', label: 'Importar Reportes Excel' },
  { id: 'importar-locales', label: 'Importar Locales Excel' },
  { id: 'importar-partidos', label: 'Importar Partidos Excel' },
  { id: 'users', label: 'Gestión Usuarios' },
  { id: 'settings', label: 'Configuración Maestra' },
  { id: 'documentacion', label: 'Documentación Sistema' },
];

const PERMISSION_LIST = [
  { id: 'admin_filter', label: 'Filtro Nacional (Ver Todo)' },
  { id: 'department_filter', label: 'Filtro Departamental' },
  { id: 'district_filter', label: 'Filtro Distrital' },
  { id: 'assign_staff', label: 'Asignar Personal en Agenda' },
  { id: 'generar_pdf', label: 'Generar Documentos PDF' },
  { id: 'ficha:edit', label: 'Editar Datos Edilicios' },
  { id: 'ficha:delete', label: 'Borrar Imágenes/Datos' },
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
      modules: editingUser.modules, 
      permissions: editingUser.permissions,
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

  if (currentUser?.profile?.role !== 'admin') {
    return (
      <div className="flex min-h-screen flex-col bg-muted/10">
        <Header title="Usuarios" />
        <main className="flex-1 p-8 flex items-center justify-center">
          <Card className="max-w-md w-full text-center p-8 border-dashed">
            <ShieldAlert className="h-16 w-16 mx-auto text-muted-foreground opacity-20 mb-4" />
            <h2 className="text-xl font-black uppercase text-primary">Acceso Denegado</h2>
            <p className="text-xs text-muted-foreground font-bold uppercase">Solo administradores pueden gestionar el personal.</p>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/5">
      <Header title="Gestión de Usuarios y Permisos" />
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-8">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 className="text-3xl font-black tracking-tight uppercase text-primary">Control de Personal</h1>
                <p className="text-muted-foreground text-sm font-medium flex items-center gap-2 mt-1">
                    <Lock className="h-4 w-4" /> Matriz de Seguridad y Accesos Granulares.
                </p>
            </div>
            <Badge className="bg-primary text-white font-black px-4 py-1 uppercase text-[10px] tracking-widest">ADMINISTRADOR</Badge>
        </div>

        <Card className="border-t-4 border-t-primary shadow-xl">
          <form onSubmit={handleSubmit}>
            <CardHeader className="bg-muted/30 border-b">
              <CardTitle className="uppercase font-black text-sm flex items-center gap-2">
                <UserPlus className="h-4 w-4" /> Registrar Nuevo Funcionario
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-8 pt-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Nombre Completo</Label>
                    <Input name="username" placeholder="NOMBRE Y APELLIDO" required className="font-bold uppercase h-11 border-2" />
                </div>
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Correo Institucional</Label>
                    <Input name="email" type="email" placeholder="usuario@tsje.gov.py" required className="font-bold h-11 border-2" />
                </div>
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Contraseña Provisoria</Label>
                    <Input name="password" type="password" placeholder="Mínimo 6 caracteres" required className="font-bold h-11 border-2" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-primary">Rol del Usuario</Label>
                    <Select onValueChange={(v: any) => setRegRole(v)} value={regRole}>
                        <SelectTrigger className="font-bold h-11 border-2"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="admin" className="font-bold">ADMINISTRADOR</SelectItem>
                            <SelectItem value="director" className="font-bold">DIRECTOR</SelectItem>
                            <SelectItem value="jefe" className="font-bold">JEFE DE OFICINA</SelectItem>
                            <SelectItem value="funcionario" className="font-bold">FUNCIONARIO</SelectItem>
                            <SelectItem value="viewer" className="font-bold">SOLO LECTURA</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Departamento Asignado</Label>
                    <Select onValueChange={setRegDepartamento} value={regDepartamento}>
                        <SelectTrigger className="font-bold h-11 border-2"><SelectValue placeholder="Elegir..." /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="N/A">ALCANCE NACIONAL</SelectItem>
                            {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Distrito Asignado</Label>
                    <Select onValueChange={setRegDistrito} value={regDistrito} disabled={!regDepartamento}>
                        <SelectTrigger className="font-bold h-11 border-2"><SelectValue placeholder="Elegir..." /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="N/A">TODOS LOS DISTRITOS</SelectItem>
                            {districts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div className="space-y-4">
                    <Label className="text-xs font-black uppercase text-primary flex items-center gap-2">
                        <Settings2 className="h-4 w-4" /> Módulos Habilitados
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-muted/20 rounded-xl border-2 border-dashed">
                        {MODULE_LIST.map(mod => (
                            <div key={mod.id} className="flex items-center space-x-2">
                                <Checkbox 
                                    id={`mod-${mod.id}`} 
                                    checked={selectedModules.has(mod.id)} 
                                    onCheckedChange={() => handleToggleModule(mod.id)} 
                                />
                                <Label htmlFor={`mod-${mod.id}`} className="text-[10px] font-bold uppercase cursor-pointer">{mod.label}</Label>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="space-y-4">
                    <Label className="text-xs font-black uppercase text-primary flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4" /> Permisos Especiales
                    </Label>
                    <div className="grid grid-cols-1 gap-3 p-4 bg-primary/5 rounded-xl border-2 border-primary/10">
                        {PERMISSION_LIST.map(p => (
                            <div key={p.id} className="flex items-center space-x-2">
                                <Checkbox 
                                    id={`perm-${p.id}`} 
                                    checked={selectedPerms.has(p.id)} 
                                    onCheckedChange={() => handleTogglePerm(p.id)} 
                                />
                                <Label htmlFor={`perm-${p.id}`} className="text-[10px] font-bold uppercase cursor-pointer">{p.label}</Label>
                            </div>
                        ))}
                    </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/30 border-t p-6">
              <Button type="submit" className="w-full h-14 font-black uppercase shadow-xl text-lg" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin mr-3 h-6 w-6" /> : <UserPlus className="mr-3 h-6 w-6" />}
                REGISTRAR FUNCIONARIO EN EL SISTEMA
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Card className="shadow-lg overflow-hidden border-none">
            <CardHeader className="bg-primary text-white py-4 px-6 flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                    <Users className="h-5 w-5" />
                    <CardTitle className="uppercase font-black text-sm tracking-widest">Lista de Usuarios ({filteredUsers.length})</CardTitle>
                </div>
                <div className="relative w-64">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
                    <Input 
                        placeholder="Buscar por nombre o correo..." 
                        className="h-9 pl-8 text-xs bg-white/10 border-white/20 text-white placeholder:text-white/40 focus-visible:ring-white/30"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </CardHeader>
            <CardContent className="p-0 bg-white">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="text-[10px] font-black uppercase">Funcionario</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">Rol y Acceso</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">Jurisdicción</TableHead>
                            <TableHead className="text-right text-[10px] font-black uppercase">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredUsers.map(user => (
                            <TableRow key={user.id} className="hover:bg-muted/20 transition-colors">
                                <TableCell className="py-4">
                                    <p className="font-black text-xs uppercase text-primary">{user.username}</p>
                                    <p className="text-[10px] text-muted-foreground">{user.email}</p>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col gap-1">
                                        <Badge variant="outline" className="w-fit text-[8px] font-black uppercase border-primary/20 bg-primary/5">
                                            {user.role}
                                        </Badge>
                                        <span className="text-[9px] font-bold text-muted-foreground uppercase">{user.modules?.length || 0} Módulos activos</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black uppercase flex items-center gap-1">
                                            <Globe className="h-3 w-3 opacity-40" /> {user.departamento || 'No asignado'}
                                        </p>
                                        <p className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1 ml-1">
                                            <MapPin className="h-2.5 w-2.5" /> {user.distrito || 'Sin distrito'}
                                        </p>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary/60 hover:text-primary hover:bg-primary/5" onClick={() => handleOpenEdit(user)}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/40 hover:text-destructive hover:bg-destructive/5">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle className="font-black uppercase">¿Eliminar Usuario?</AlertDialogTitle>
                                                    <AlertDialogDescription className="text-sm">
                                                        Esta acción retirará todos los accesos de <strong>{user.username}</strong> de forma permanente.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel className="font-bold text-[10px] uppercase">Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteUser(user.id)} className="bg-destructive text-white font-black text-[10px] uppercase">Eliminar Acceso</AlertDialogAction>
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

      {/* Edit User Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
          {editingUser && (
            <form onSubmit={handleUpdateUser} className="flex flex-col h-full">
              <DialogHeader className="p-6 bg-primary text-white shrink-0">
                <DialogTitle className="text-xl font-black uppercase">Editar Perfil Institucional</DialogTitle>
                <DialogDescription className="text-white/70 font-bold uppercase text-[10px]">
                    Modificando accesos para: {editingUser.username}
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="flex-1 p-6">
                <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Rol</Label>
                            <Select onValueChange={(v: any) => setEditingUser({...editingUser, role: v})} value={editingUser.role}>
                                <SelectTrigger className="font-bold h-11 border-2"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="admin" className="font-bold">ADMINISTRADOR</SelectItem>
                                    <SelectItem value="director" className="font-bold">DIRECTOR</SelectItem>
                                    <SelectItem value="jefe" className="font-bold">JEFE DE OFICINA</SelectItem>
                                    <SelectItem value="funcionario" className="font-bold">FUNCIONARIO</SelectItem>
                                    <SelectItem value="viewer" className="font-bold">SOLO LECTURA</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Departamento</Label>
                            <Select onValueChange={(v) => setEditingUser({...editingUser, departamento: v, distrito: ''})} value={editingUser.departamento}>
                                <SelectTrigger className="font-bold h-11 border-2"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="N/A">ALCANCE NACIONAL</SelectItem>
                                    {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Distrito</Label>
                            <Select onValueChange={(v) => setEditingUser({...editingUser, distrito: v})} value={editingUser.distrito} disabled={!editingUser.departamento}>
                                <SelectTrigger className="font-bold h-11 border-2"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="N/A">TODOS LOS DISTRITOS</SelectItem>
                                    {datosData?.filter(d => d.departamento === editingUser.departamento).map(d => <SelectItem key={d.distrito} value={d.distrito}>{d.distrito}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <Label className="text-xs font-black uppercase text-primary">Módulos</Label>
                            <div className="grid grid-cols-1 gap-2 p-4 bg-muted/20 rounded-xl border-2 border-dashed">
                                {MODULE_LIST.map(mod => (
                                    <div key={mod.id} className="flex items-center space-x-2">
                                        <Checkbox 
                                            id={`edit-mod-${mod.id}`} 
                                            checked={editingUser.modules?.includes(mod.id)} 
                                            onCheckedChange={(checked) => {
                                                const next = checked 
                                                    ? [...(editingUser.modules || []), mod.id]
                                                    : (editingUser.modules || []).filter(id => id !== mod.id);
                                                setEditingUser({...editingUser, modules: next});
                                            }} 
                                        />
                                        <Label htmlFor={`edit-mod-${mod.id}`} className="text-[10px] font-bold uppercase cursor-pointer">{mod.label}</Label>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-4">
                            <Label className="text-xs font-black uppercase text-primary">Permisos Especiales</Label>
                            <div className="grid grid-cols-1 gap-2 p-4 bg-primary/5 rounded-xl border-2 border-primary/10">
                                {PERMISSION_LIST.map(p => (
                                    <div key={p.id} className="flex items-center space-x-2">
                                        <Checkbox 
                                            id={`edit-perm-${p.id}`} 
                                            checked={editingUser.permissions?.includes(p.id)} 
                                            onCheckedChange={(checked) => {
                                                const next = checked 
                                                    ? [...(editingUser.permissions || []), p.id]
                                                    : (editingUser.permissions || []).filter(id => id !== p.id);
                                                setEditingUser({...editingUser, permissions: next});
                                            }} 
                                        />
                                        <Label htmlFor={`edit-perm-${p.id}`} className="text-[10px] font-bold uppercase cursor-pointer">{p.label}</Label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
              </ScrollArea>
              <DialogFooter className="p-6 bg-muted/30 border-t">
                <DialogClose asChild><Button variant="outline" type="button" className="font-bold uppercase text-xs">Cancelar</Button></DialogClose>
                <Button type="submit" disabled={isSubmitting} className="font-black uppercase text-xs px-8">
                    {isSubmitting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                    Guardar Cambios
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
