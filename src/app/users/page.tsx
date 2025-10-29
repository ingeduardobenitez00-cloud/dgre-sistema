"use client";

import { useState } from 'react';
import Header from '@/components/header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Eye, EyeOff, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

export default function UsersPage() {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const { toast } = useToast();

  const togglePasswordVisibility = () => {
    setPasswordVisible(!passwordVisible);
  };
  
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Here you would handle form submission, e.g., send data to an API
    toast({
      title: 'Usuario Creado',
      description: 'El nuevo usuario ha sido guardado con éxito (simulado).',
    });
    // Optionally reset the form
    event.currentTarget.reset();
  };

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header title="Gestión de Usuarios" />
      <main className="flex flex-1 flex-col items-center p-4 gap-8">
        <Card className="w-full max-w-2xl">
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Crear Nuevo Usuario
              </CardTitle>
              <CardDescription>
                Rellena los campos para añadir un nuevo usuario al sistema.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="username">Usuario</Label>
                  <Input id="username" placeholder="ej. juanperez" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Correo Electrónico</Label>
                  <Input id="email" type="email" placeholder="ej. juan.perez@dominio.com" required />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <div className="relative">
                    <Input id="password" type={passwordVisible ? 'text' : 'password'} placeholder="••••••••" required />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute inset-y-0 right-0 h-full w-10 text-muted-foreground"
                      onClick={togglePasswordVisibility}
                    >
                      {passwordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="role">Rol</Label>
                    <Select name="role" required>
                        <SelectTrigger id="role">
                        <SelectValue placeholder="Seleccionar un rol" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="admin">Administrador</SelectItem>
                            <SelectItem value="editor">Editor</SelectItem>
                            <SelectItem value="viewer">Visualizador</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
              </div>
              
              <Separator />

              <div className="space-y-4">
                <Label>Acceso a Módulos</Label>
                <div className="flex items-center space-x-2">
                  <Checkbox id="access-fotos" defaultChecked />
                  <Label htmlFor="access-fotos" className="font-normal">
                    Fotos
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="access-config" />
                  <Label htmlFor="access-config" className="font-normal">
                    Configuración
                  </Label>
                </div>
                 <div className="flex items-center space-x-2">
                  <Checkbox id="access-users" />
                  <Label htmlFor="access-users" className="font-normal">
                    Usuarios
                  </Label>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label>Permisos</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="flex items-center space-x-2">
                        <Checkbox id="perm-add" />
                        <Label htmlFor="perm-add" className="font-normal">
                            Agregar
                        </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox id="perm-edit" />
                        <Label htmlFor="perm-edit" className="font-normal">
                            Editar
                        </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox id="perm-delete" />
                        <Label htmlFor="perm-delete" className="font-normal">
                            Borrar
                        </Label>
                    </div>
                </div>
              </div>

            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full">Guardar Usuario</Button>
            </CardFooter>
          </form>
        </Card>
      </main>
    </div>
  );
}
