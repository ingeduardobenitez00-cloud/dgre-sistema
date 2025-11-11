
'use client';

import { useState, useMemo } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { type AuditLog } from '@/lib/data';
import { Loader2, Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

export default function AuditoriaPage() {
  const { firestore, user } = useFirebase();

  const auditLogsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'audit-logs'), orderBy('timestamp', 'desc'));
  }, [firestore, user]);

  const { data: auditLogs, isLoading } = useCollection<AuditLog>(auditLogsQuery);
  const { data: usersData } = useCollection(useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]));

  const [searchTerm, setSearchTerm] = useState('');
  const [userFilter, setUserFilter] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<string | null>(null);

  const filteredLogs = useMemo(() => {
    return auditLogs
      ?.filter(log => {
        const lowerSearch = searchTerm.toLowerCase();
        const matchesSearch =
          log.userEmail.toLowerCase().includes(lowerSearch) ||
          log.action.toLowerCase().includes(lowerSearch) ||
          log.entity.toLowerCase().includes(lowerSearch) ||
          log.entityId.toLowerCase().includes(lowerSearch);
        
        const matchesUser = !userFilter || log.userEmail === userFilter;
        const matchesAction = !actionFilter || log.action === actionFilter;

        return matchesSearch && matchesUser && matchesAction;
      }) || [];
  }, [auditLogs, searchTerm, userFilter, actionFilter]);

  const uniqueActions = useMemo(() => {
    if (!auditLogs) return [];
    return [...new Set(auditLogs.map(log => log.action))];
  }, [auditLogs]);


  const formatTimestamp = (timestamp: any): string => {
    if (!timestamp) return 'Fecha no disponible';
    try {
      const date = timestamp.toDate();
      return format(date, "dd 'de' LLLL 'de' yyyy, HH:mm:ss", { locale: es });
    } catch (e) {
        if (typeof timestamp === 'string') {
           try {
            return format(parseISO(timestamp), "dd 'de' LLLL 'de' yyyy, HH:mm:ss", { locale: es });
           } catch (e2) {
            return timestamp;
           }
        }
        return 'Fecha inválida';
    }
  };


  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header title="Auditoría del Sistema" />
      <main className="flex-1 p-4 sm:p-6 md:p-8">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Registro de Actividad</CardTitle>
            <CardDescription>
              Aquí puedes ver un registro de todas las acciones importantes realizadas por los usuarios en el sistema.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por correo, acción, entidad..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" className="shrink-0">
                        <Filter className="mr-2 h-4 w-4" />
                        {userFilter ? `Usuario: ${userFilter}` : 'Filtrar por Usuario'}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0">
                    <Command>
                        <CommandInput placeholder="Buscar usuario..." />
                        <CommandList>
                            <CommandEmpty>No se encontraron usuarios.</CommandEmpty>
                            <CommandGroup>
                                <CommandItem onSelect={() => setUserFilter(null)}>Todos los usuarios</CommandItem>
                                {usersData?.map(u => (
                                    <CommandItem key={u.id} onSelect={() => setUserFilter(u.email)}>{u.email}</CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
              </Popover>
               <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" className="shrink-0">
                        <Filter className="mr-2 h-4 w-4" />
                        {actionFilter ? `Acción: ${actionFilter}` : 'Filtrar por Acción'}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0">
                    <Command>
                        <CommandInput placeholder="Buscar acción..." />
                         <CommandList>
                            <CommandEmpty>No se encontraron acciones.</CommandEmpty>
                            <CommandGroup>
                                <CommandItem onSelect={() => setActionFilter(null)}>Todas las acciones</CommandItem>
                                {uniqueActions.map(action => (
                                    <CommandItem key={action} onSelect={() => setActionFilter(action)}>{action}</CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
              </Popover>
            </div>

            {isLoading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
            ) : (
              <div className="border rounded-md max-h-[60vh] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted">
                    <TableRow>
                      <TableHead>Fecha y Hora</TableHead>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Acción</TableHead>
                      <TableHead>Entidad</TableHead>
                      <TableHead>ID de Entidad</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.length > 0 ? (
                      filteredLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-medium whitespace-nowrap">{formatTimestamp(log.timestamp)}</TableCell>
                          <TableCell>{log.userEmail}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{log.action}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{log.entity}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{log.entityId}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center">
                          No se encontraron registros de auditoría.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
