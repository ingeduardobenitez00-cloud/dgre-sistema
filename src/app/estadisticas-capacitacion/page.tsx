
"use client";

import { useMemo } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirebase, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { type EncuestaSatisfaccion } from '@/lib/data';
import { Loader2, PieChart as PieChartIcon, BarChart3, Users, ClipboardCheck, Landmark, ShieldAlert } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell as RechartsCell
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function EstadisticasCapacitacionPage() {
  const { firestore } = useFirebase();
  const { user, isUserLoading } = useUser();

  const encuestasQuery = useMemoFirebase(() => {
    if (!firestore || isUserLoading || !user?.profile) return null;
    const colRef = collection(firestore, 'encuestas-satisfaccion');
    const profile = user.profile;

    const hasAdminFilter = ['admin', 'director'].includes(profile.role || '') || profile.permissions?.includes('admin_filter');
    const hasDeptFilter = profile.permissions?.includes('department_filter');
    const hasDistFilter = profile.permissions?.includes('district_filter') || profile.role === 'jefe' || profile.role === 'funcionario';

    if (hasAdminFilter) return colRef;
    
    if (hasDeptFilter && profile.departamento) {
        return query(colRef, where('departamento', '==', profile.departamento));
    }

    if (hasDistFilter && profile.departamento && profile.distrito) {
        return query(colRef, where('departamento', '==', profile.departamento), where('distrito', '==', profile.distrito));
    }
    
    return null;
  }, [firestore, user, isUserLoading]);

  const { data: encuestas, isLoading } = useCollection<EncuestaSatisfaccion>(encuestasQuery);

  const stats = useMemo(() => {
    if (!encuestas) return null;

    const summary = {
      total: encuestas.length,
      utilidad: { muy_util: 0, util: 0, poco_util: 0, nada_util: 0 },
      facilidad: { muy_facil: 0, facil: 0, poco_facil: 0, nada_facil: 0 },
      seguridad: { muy_seguro: 0, seguro: 0, poco_seguro: 0, nada_seguro: 0 },
      genero: { hombre: 0, mujer: 0 },
      pueblo_originario: 0,
      edades: { '18-25': 0, '26-40': 0, '41-60': 0, '60+': 0 }
    };

    encuestas.forEach(e => {
      if (e.utilidad_maquina) summary.utilidad[e.utilidad_maquina]++;
      if (e.facilidad_maquina) summary.facilidad[e.facilidad_maquina]++;
      if (e.seguridad_maquina) summary.seguridad[e.seguridad_maquina]++;
      if (e.genero) summary.genero[e.genero]++;
      if (e.pueblo_originario) summary.pueblo_originario++;
      
      const edad = parseInt(e.edad);
      if (edad <= 25) summary.edades['18-25']++;
      else if (edad <= 40) summary.edades['26-40']++;
      else if (edad <= 60) summary.edades['41-60']++;
      else summary.edades['60+']++;
    });

    const formatData = (obj: any, labels: any) => 
      Object.entries(obj).map(([key, value]) => ({ name: labels[key] || key, value }));

    return {
      total: summary.total,
      pueblo_originario: summary.pueblo_originario,
      utilidadData: formatData(summary.utilidad, { muy_util: 'Muy Útil', util: 'Útil', poco_util: 'Poco Útil', nada_util: 'Nada Útil' }),
      facilidadData: formatData(summary.facilidad, { muy_facil: 'Muy Fácil', facil: 'Fácil', poco_facil: 'Poco Fácil', nada_facil: 'Nada Fácil' }),
      seguridadData: formatData(summary.seguridad, { muy_seguro: 'Muy Seguro', seguro: 'Seguro', poco_seguro: 'Poco Seguro', nada_seguro: 'Nada Seguro' }),
      generoData: formatData(summary.genero, { hombre: 'Hombre', mujer: 'Mujer' }),
      edadesData: Object.entries(summary.edades).map(([key, value]) => ({ name: key, value }))
    };
  }, [encuestas]);

  if (isUserLoading || isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;

  const hasGlobalView = ['admin', 'director'].includes(user?.profile?.role || '') || user?.profile?.permissions?.includes('admin_filter') || user?.profile?.permissions?.includes('department_filter') || user?.profile?.permissions?.includes('district_filter');
  const hasNoJurisdiction = user && !user.profile?.departamento && !hasGlobalView;

  if (hasNoJurisdiction) {
    return (
      <div className="flex min-h-screen flex-col bg-muted/10">
        <Header title="Analítica CIDEE" />
        <main className="flex-1 p-8 flex items-center justify-center">
          <Card className="max-w-md w-full text-center p-8 border-dashed">
            <ShieldAlert className="h-16 w-16 mx-auto text-muted-foreground opacity-20 mb-4" />
            <h2 className="text-xl font-black uppercase text-primary mb-2">Acceso Restringido</h2>
            <p className="text-xs text-muted-foreground font-bold uppercase">No tienes una jurisdicción asignada para ver estadísticas.</p>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/5">
      <Header title="Estadísticas de Capacitación" />
      <main className="flex-1 p-4 md:p-8 space-y-8 max-w-7xl mx-auto w-full">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight uppercase text-primary">Analítica Institucional</h1>
            <p className="text-muted-foreground text-sm font-medium flex items-center gap-2 mt-1">
                <Landmark className="h-4 w-4" />
                Jurisdicción: <span className="font-black text-primary uppercase">
                    {hasGlobalView && !user?.profile?.departamento ? 'Alcance Nacional' : `${user?.profile?.distrito} - ${user?.profile?.departamento}`}
                </span>
            </p>
          </div>
          <div className="flex gap-4">
            <Card className="bg-primary text-white px-6 py-4 shadow-xl border-none">
                <div className="text-[10px] font-black uppercase opacity-70 tracking-widest leading-none mb-1">Total Encuestas</div>
                <div className="text-3xl font-black">{stats?.total || 0}</div>
            </Card>
            <Card className="bg-white border-2 border-primary/10 px-6 py-4 shadow-sm">
                <div className="text-[10px] font-black uppercase text-primary tracking-widest leading-none mb-1">Pueblos Originarios</div>
                <div className="text-3xl font-black text-primary">{stats?.pueblo_originario || 0}</div>
            </Card>
          </div>
        </div>

        {!stats || stats.total === 0 ? (
          <Card className="p-20 text-center border-dashed bg-white">
            <ClipboardCheck className="mx-auto h-16 w-16 text-muted-foreground opacity-20 mb-4" />
            <p className="text-lg font-black text-muted-foreground uppercase">No hay datos procesados en esta zona.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="shadow-lg border-t-4 border-t-blue-600 bg-white">
              <CardHeader className="pb-2 border-b mb-4 bg-muted/10">
                <CardTitle className="text-[10px] font-black flex items-center gap-2 uppercase tracking-widest">
                  <BarChart3 className="h-4 w-4 text-blue-600" /> Utilidad de la Práctica
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.utilidadData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" fontSize={9} fontWeight="bold" />
                    <YAxis fontSize={9} fontWeight="bold" />
                    <Tooltip />
                    <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-t-4 border-t-green-600 bg-white">
              <CardHeader className="pb-2 border-b mb-4 bg-muted/10">
                <CardTitle className="text-[10px] font-black flex items-center gap-2 uppercase tracking-widest">
                  <BarChart3 className="h-4 w-4 text-green-600" /> Facilidad de Uso
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.facilidadData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" fontSize={9} fontWeight="bold" />
                    <YAxis fontSize={9} fontWeight="bold" />
                    <Tooltip />
                    <Bar dataKey="value" fill="#16a34a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-t-4 border-t-amber-600 bg-white">
              <CardHeader className="pb-2 border-b mb-4 bg-muted/10">
                <CardTitle className="text-[10px] font-black flex items-center gap-2 uppercase tracking-widest">
                  <BarChart3 className="h-4 w-4 text-amber-600" /> Nivel de Seguridad
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.seguridadData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" fontSize={9} fontWeight="bold" />
                    <YAxis fontSize={9} fontWeight="bold" />
                    <Tooltip />
                    <Bar dataKey="value" fill="#d97706" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-t-4 border-t-purple-600 bg-white">
              <CardHeader className="pb-2 border-b mb-4 bg-muted/10">
                <CardTitle className="text-[10px] font-black flex items-center gap-2 uppercase tracking-widest">
                  <PieChartIcon className="h-4 w-4 text-purple-600" /> Distribución de Género
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stats.generoData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                      {stats.generoData.map((entry, index) => (
                        <RechartsCell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-t-4 border-t-rose-600 lg:col-span-2 bg-white">
              <CardHeader className="pb-2 border-b mb-4 bg-muted/10">
                <CardTitle className="text-[10px] font-black flex items-center gap-2 uppercase tracking-widest">
                  <Users className="h-4 w-4 text-rose-600" /> Rango de Edad de los Participantes
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.edadesData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" fontSize={9} fontWeight="bold" />
                    <YAxis dataKey="name" type="category" fontSize={9} fontWeight="bold" />
                    <Tooltip />
                    <Bar dataKey="value" fill="#e11d48" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
