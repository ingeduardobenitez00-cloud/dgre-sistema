
"use client";

import { useMemo } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirebase, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { type EncuestaSatisfaccion } from '@/lib/data';
import { Loader2, PieChart as PieChartIcon, BarChart3, Users, ClipboardCheck } from 'lucide-react';
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
  Cell,
  Cell as RechartsCell
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function EstadisticasCapacitacionPage() {
  const { firestore } = useFirebase();
  const { user } = useUser();

  const encuestasQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'encuestas-satisfaccion');
  }, [firestore]);

  const { data: encuestas, isLoading } = useCollection<EncuestaSatisfaccion>(encuestasQuery);

  const stats = useMemo(() => {
    if (!encuestas) return null;

    const summary = {
      total: encuestas.length,
      utilidad: { muy_util: 0, util: 0, poco_util: 0, nada_util: 0 },
      facilidad: { muy_facil: 0, facil: 0, poco_facil: 0, nada_facil: 0 },
      seguridad: { muy_seguro: 0, seguro: 0, poco_seguro: 0, nada_seguro: 0 },
      genero: { hombre: 0, mujer: 0, pueblo_originario: 0 },
      edades: { '18-25': 0, '26-40': 0, '41-60': 0, '60+': 0 }
    };

    encuestas.forEach(e => {
      if (e.utilidad_maquina) summary.utilidad[e.utilidad_maquina]++;
      if (e.facilidad_maquina) summary.facilidad[e.facilidad_maquina]++;
      if (e.seguridad_maquina) summary.seguridad[e.seguridad_maquina]++;
      if (e.genero) summary.genero[e.genero]++;
      
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
      utilidadData: formatData(summary.utilidad, { muy_util: 'Muy Útil', util: 'Útil', poco_util: 'Poco Útil', nada_util: 'Nada Útil' }),
      facilidadData: formatData(summary.facilidad, { muy_facil: 'Muy Fácil', facil: 'Fácil', poco_facil: 'Poco Fácil', nada_facil: 'Nada Fácil' }),
      seguridadData: formatData(summary.seguridad, { muy_seguro: 'Muy Seguro', seguro: 'Seguro', poco_seguro: 'Poco Seguro', nada_seguro: 'Nada Seguro' }),
      generoData: formatData(summary.genero, { hombre: 'Hombre', mujer: 'Mujer', pueblo_originario: 'Pueblo Orig.' }),
      edadesData: Object.entries(summary.edades).map(([key, value]) => ({ name: key, value }))
    };
  }, [encuestas]);

  if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <Header title="Estadísticas de Capacitación" />
      <main className="flex-1 p-4 md:p-8 space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight uppercase">Analítica CIDEE</h1>
            <p className="text-muted-foreground">Resultados consolidados de las encuestas de satisfacción.</p>
          </div>
          <Card className="bg-primary text-primary-foreground px-6 py-3">
            <div className="text-sm font-bold uppercase opacity-80">Encuestas Totales</div>
            <div className="text-3xl font-black">{stats?.total || 0}</div>
          </Card>
        </div>

        {!stats || stats.total === 0 ? (
          <Card className="p-12 text-center">
            <ClipboardCheck className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-muted-foreground">No hay encuestas registradas para generar estadísticas.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Utilidad */}
            <Card className="shadow-md border-t-4 border-t-blue-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-blue-500" /> ¿ES ÚTIL LA PRÁCTICA?
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.utilidadData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" fontSize={10} />
                    <YAxis fontSize={10} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Facilidad */}
            <Card className="shadow-md border-t-4 border-t-green-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-green-500" /> ¿ES FÁCIL DE USAR?
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.facilidadData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" fontSize={10} />
                    <YAxis fontSize={10} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Seguridad */}
            <Card className="shadow-md border-t-4 border-t-amber-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-amber-500" /> PERCEPCIÓN DE SEGURIDAD
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.seguridadData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" fontSize={10} />
                    <YAxis fontSize={10} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Género */}
            <Card className="shadow-md border-t-4 border-t-purple-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <PieChartIcon className="h-4 w-4 text-purple-500" /> DISTRIBUCIÓN POR GÉNERO
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
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Edades */}
            <Card className="shadow-md border-t-4 border-t-rose-500 lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4 text-rose-500" /> PARTICIPACIÓN POR RANGO DE EDAD
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.edadesData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" fontSize={10} />
                    <YAxis dataKey="name" type="category" fontSize={10} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#f43f5e" radius={[0, 4, 4, 0]} />
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
