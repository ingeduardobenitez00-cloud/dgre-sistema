
'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirebase, useMemoFirebase } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection } from 'firebase/firestore';
import { type ReportData } from '@/lib/data';
import { CheckCircle, Shield, Landmark, Warehouse, Loader2 } from 'lucide-react';

type SummaryCounts = {
  total: number;
  seguros: number;
  comisarias: number;
  registrosElectorales: number;
  otros: number;
};

function ResumenCard({ title, value, icon: Icon }: { title: string, value: number, icon: React.ElementType }) {
    return (
        <Card className="flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
            </CardContent>
        </Card>
    )
}

export default function ResumenPage() {
  const { firestore } = useFirebase();

  const reportsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'reports') : null, [firestore]);
  const { data: reports, isLoading } = useCollection<ReportData>(reportsQuery);

  const [summary, setSummary] = useState<SummaryCounts>({
    total: 0,
    seguros: 0,
    comisarias: 0,
    registrosElectorales: 0,
    otros: 0,
  });

  useEffect(() => {
    if (reports) {
      const newSummary: SummaryCounts = {
        total: reports.length,
        seguros: 0,
        comisarias: 0,
        registrosElectorales: 0,
        otros: 0,
      };

      reports.forEach(report => {
        const lugar = report['lugar-resguardo']?.toUpperCase();
        if (lugar?.includes('HABITACION SEGURA')) {
          newSummary.seguros++;
        } else if (lugar?.includes('COMISARIA')) {
          newSummary.comisarias++;
        } else if (lugar?.includes('REGISTRO')) {
          newSummary.registrosElectorales++;
        } else {
          newSummary.otros++;
        }
      });
      setSummary(newSummary);
    }
  }, [reports]);

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header title="Resumen de Estados" />
      <main className="flex flex-1 flex-col p-4 gap-8">
        <Card className="w-full max-w-6xl mx-auto">
          <CardHeader>
            <CardTitle>Resumen General</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
                 <div className="flex justify-center items-center h-24">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                 </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <ResumenCard title="Registros Seguros" value={summary.seguros} icon={CheckCircle} />
                    <ResumenCard title="Comisarías" value={summary.comisarias} icon={Shield} />
                    <ResumenCard title="Registros Electorales" value={summary.registrosElectorales} icon={Landmark} />
                    <ResumenCard title="Otros Lugares" value={summary.otros} icon={Warehouse} />
                </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
