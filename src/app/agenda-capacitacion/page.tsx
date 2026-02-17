
"use client";

import { useState, useMemo } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { useUser, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { type SolicitudCapacitacion } from '@/lib/data';
import { Loader2, Calendar, MapPin, User, FileImage, ClipboardCheck, LayoutList, Building2, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';

export default function AgendaCapacitacionPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();

  const solicitudesQuery = useMemoFirebase(() => {
    if (!firestore || !user?.profile) return null;
    
    const colRef = collection(firestore, 'solicitudes-capacitacion');
    
    // Roles administrativos (Admin, Director, Jefe) pueden ver todo
    const isAdministrative = user.profile.role === 'admin' || user.profile.role === 'director' || user.profile.role === 'jefe';

    if (isAdministrative) {
      return query(colRef, orderBy('fecha', 'asc'));
    }
    
    // Los funcionarios deben filtrar su consulta por departamento y distrito
    if (user.profile.role === 'funcionario' && user.profile.departamento && user.profile.distrito) {
      return query(
        colRef,
        where('departamento', '==', user.profile.departamento),
        where('distrito', '==', user.profile.distrito),
        orderBy('fecha', 'asc')
      );
    }
    
    return null;
  }, [firestore, user]);

  const { data: solicitudes, isLoading } = useCollection<SolicitudCapacitacion>(solicitudesQuery);

  const groupedData = useMemo(() => {
    if (!solicitudes) return {};
    const groups: Record<string, Record<string, SolicitudCapacitacion[]>> = {};
    
    solicitudes.forEach(s => {
      const dept = s.departamento || 'SIN DEPARTAMENTO';
      const dist = s.distrito || 'SIN DISTRITO';
      if (!groups[dept]) groups[dept] = {};
      if (!groups[dept][dist]) groups[dept][dist] = [];
      groups[dept][dist].push(s);
    });

    return groups;
  }, [solicitudes]);

  const stats = useMemo(() => {
    if (!solicitudes) return { total: 0, depts: 0 };
    return {
      total: solicitudes.length,
      depts: Object.keys(groupedData).length
    };
  }, [solicitudes, groupedData]);

  if (isUserLoading || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-primary"/>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/10">
      <Header title="Agenda Consolidada - CIDEE" />
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        
        {/* Cabecera del Reporte */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 bg-white p-6 rounded-lg border shadow-sm">
          <div>
            <h1 className="text-3xl font-black tracking-tight uppercase text-primary">Reporte de Agenda de Capacitaciones</h1>
            <p className="text-muted-foreground flex items-center gap-2 mt-1">
              <LayoutList className="h-4 w-4" />
              Consolidado nacional de actividades programadas por el CIDEE.
            </p>
          </div>
          <div className="flex gap-4">
            <div className="text-center px-4 py-2 bg-primary/5 rounded-md border border-primary/10">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Departamentos</p>
              <p className="text-2xl font-black text-primary">{stats.depts}</p>
            </div>
            <div className="text-center px-4 py-2 bg-primary/5 rounded-md border border-primary/10">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Total Solicitudes</p>
              <p className="text-2xl font-black text-primary">{stats.total}</p>
            </div>
          </div>
        </div>

        {Object.keys(groupedData).length === 0 ? (
          <Card className="p-12 text-center border-dashed">
            <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-muted-foreground">No hay capacitaciones agendadas en la base de datos.</p>
            <Link href="/solicitud-capacitacion" className="mt-4 inline-block">
              <Button variant="outline">Crear Primera Solicitud</Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-6">
            <Accordion type="multiple" className="w-full space-y-4">
              {Object.entries(groupedData).map(([dept, distritos]) => (
                <AccordionItem key={dept} value={dept} className="border bg-white rounded-lg overflow-hidden shadow-sm">
                  <AccordionTrigger className="hover:no-underline px-6 py-4 bg-muted/30">
                    <div className="flex items-center gap-4 text-left">
                      <div className="h-10 w-10 rounded bg-primary text-white flex items-center justify-center font-black">
                        {dept.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h2 className="text-xl font-bold uppercase tracking-tight">{dept}</h2>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">
                          {Object.values(distritos).flat().length} ACTIVIDADES PROGRAMADAS
                        </span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-0">
                    <div className="divide-y border-t">
                      {Object.entries(distritos).map(([dist, items]) => (
                        <div key={dist} className="p-6 bg-white">
                          <div className="flex items-center gap-2 mb-4">
                            <Building2 className="h-5 w-5 text-primary" />
                            <h3 className="text-lg font-black uppercase text-foreground/80">{dist}</h3>
                            <Badge variant="secondary" className="ml-2 font-mono">
                              {items.length} {items.length === 1 ? 'SOLICITUD' : 'SOLICITUDES'}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-1 gap-4">
                            {items.map((item) => (
                              <div key={item.id} className="group relative border rounded-md p-4 hover:border-primary transition-all bg-muted/5">
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                                  
                                  {/* Columna Entidad */}
                                  <div className="lg:col-span-3">
                                    <p className="text-[10px] font-bold text-primary uppercase">Solicitante</p>
                                    <p className="font-black text-sm uppercase leading-tight">{item.solicitante_entidad}</p>
                                    <Badge variant="outline" className="mt-1 text-[9px] uppercase font-bold">
                                      {item.tipo_solicitud === 'divulgacion' ? 'Divulgación' : 'Capacitación'}
                                    </Badge>
                                  </div>

                                  {/* Columna Lugar y Fecha */}
                                  <div className="lg:col-span-4 flex flex-col gap-1">
                                    <div className="flex items-start gap-2">
                                      <MapPin className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                                      <div>
                                        <p className="text-xs font-bold uppercase">{item.lugar_local}</p>
                                        <p className="text-[10px] text-muted-foreground">{item.direccion_calle}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                      <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
                                      <p className="text-[10px] font-bold uppercase">
                                        {new Date(item.fecha + 'T12:00:00').toLocaleDateString('es-PY', { weekday: 'short', day: '2-digit', month: 'short' })}
                                        <span className="mx-1 text-primary">|</span>
                                        {item.hora_desde} a {item.hora_hasta} HS
                                      </p>
                                    </div>
                                  </div>

                                  {/* Columna Responsable */}
                                  <div className="lg:col-span-3">
                                    <div className="flex items-center gap-2">
                                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                                      <div>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase leading-none">Responsable</p>
                                        <p className="text-xs font-bold truncate">{item.nombre_completo}</p>
                                        <p className="text-[10px] text-muted-foreground">C.I. {item.cedula}</p>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Columna Acciones */}
                                  <div className="lg:col-span-2 flex justify-end gap-2">
                                    {item.foto_firma && (
                                      <Dialog>
                                        <DialogTrigger asChild>
                                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Ver Anexo V">
                                            <FileImage className="h-4 w-4 text-primary" />
                                          </Button>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-2xl">
                                          <DialogHeader>
                                            <DialogTitle className="uppercase font-black">Anexo V - Solicitud Firmada</DialogTitle>
                                          </DialogHeader>
                                          <div className="relative aspect-[3/4] w-full mt-4 bg-muted rounded-lg overflow-hidden border shadow-inner">
                                            <Image src={item.foto_firma} alt="Firma Anexo V" fill className="object-contain" />
                                          </div>
                                        </DialogContent>
                                      </Dialog>
                                    )}
                                    <Link href={`/encuesta-satisfaccion?solicitudId=${item.id}`}>
                                      <Button variant="default" size="sm" className="h-8 text-[10px] font-black uppercase">
                                        <ClipboardCheck className="mr-1 h-3 w-3" />
                                        Encuesta
                                      </Button>
                                    </Link>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        )}
      </main>
    </div>
  );
}
