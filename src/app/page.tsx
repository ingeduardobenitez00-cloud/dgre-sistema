
'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Loader2, ChevronRight } from 'lucide-react';
import Header from '@/components/header';
import { useUser } from '@/firebase';
import { dashboardMenuItems } from '@/lib/menu-config';

const MODULE_GROUPS = [
  {
    label: "CIDEE - CAPACITACIONES",
    description: "Gestión de solicitudes, agendas, encuestas e informes de capacitación nacional.",
    modules: ['solicitud-capacitacion', 'agenda-capacitacion', 'encuesta-satisfaccion', 'informe-divulgador', 'informe-semanal-puntos-fijos', 'estadisticas-capacitacion']
  },
  {
    label: "Registros Electorales",
    description: "Administración edilicia, visualización de fichas técnicas y galerías fotográficas.",
    modules: ['ficha', 'fotos', 'cargar-ficha']
  },
  {
    label: "Análisis y Reportes",
    description: "Consolidados nacionales, resúmenes por ubicación y generación de informes generales en PDF.",
    modules: ['resumen', 'informe-general']
  },
  {
    label: "Locales de Votación",
    description: "Buscador georreferenciado de locales y carga masiva de fotografías de campo.",
    modules: ['locales-votacion', 'cargar-fotos-locales']
  },
  {
    label: "Gestión de Datos",
    description: "Herramientas de importación masiva de reportes y locales desde archivos externos.",
    modules: ['importar-reportes', 'importar-locales']
  },
  {
    label: "Sistema",
    description: "Administración de usuarios, permisos, roles y configuración geográfica del sistema.",
    modules: ['users', 'settings']
  },
];

export default function Home() {
  const { user, isUserLoading } = useUser();

  const groupedModules = useMemo(() => {
    if (!user) return [];

    return MODULE_GROUPS.map(group => {
      const accessibleInGroup = dashboardMenuItems.filter(item => {
        const moduleName = item.href.substring(1);
        const hasAccess = user.profile?.role === 'admin' || user.profile?.modules?.includes(moduleName);
        return group.modules.includes(moduleName) && hasAccess;
      });

      return {
        ...group,
        items: accessibleInGroup
      };
    }).filter(group => group.items.length > 0);
  }, [user]);

  if (isUserLoading) {
    return (
      <div className="flex min-h-screen w-full flex-col">
        <Header title="Cargando Panel..." />
        <main className="flex flex-1 items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/5">
      <Header title="Panel de Gestión Integral" />
      <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full">
        <div className="mb-10">
            <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl uppercase">
                Bienvenido, <span className="text-primary">{user?.profile?.username || 'Usuario'}</span>
            </h1>
            <p className="mt-2 text-lg text-muted-foreground font-medium">
                Sistema de Gestión de la Justicia Electoral. Seleccione una categoría para comenzar.
            </p>
        </div>

        <div className="space-y-12">
          {groupedModules.map((group) => (
            <section key={group.label} className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-2 border-b pb-4">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-wider text-primary flex items-center gap-2">
                    <span className="h-6 w-1 bg-primary rounded-full"></span>
                    {group.label}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">{group.description}</p>
                </div>
                <span className="text-[10px] font-bold bg-primary/10 text-primary px-3 py-1 rounded-full uppercase tracking-tighter">
                  {group.items.length} Módulos Activos
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.items.map((item) => (
                  <Link href={item.href} key={item.href} className="group">
                    <Card className="h-full transition-all duration-300 ease-out hover:shadow-xl hover:border-primary/40 hover:-translate-y-1 bg-white overflow-hidden border-muted">
                      <CardHeader className="flex flex-row items-start gap-4 p-5">
                        <div className="p-3 rounded-xl bg-primary/5 text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300 shadow-sm">
                          <item.icon className="h-6 w-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base font-bold uppercase group-hover:text-primary transition-colors flex items-center justify-between">
                            {item.label}
                            <ChevronRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                          </CardTitle>
                          <CardDescription className="mt-1.5 text-xs line-clamp-2 font-medium leading-relaxed">
                            {item.description}
                          </CardDescription>
                        </div>
                      </CardHeader>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
