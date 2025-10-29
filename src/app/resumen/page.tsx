
'use client';

import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

export default function ResumenPage() {

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header title="Resumen de Estados" />
      <main className="flex flex-1 flex-col items-center justify-center p-4 gap-8">
        <Card className="w-full max-w-lg text-center">
            <CardHeader>
                <CardTitle className="flex items-center justify-center gap-2">
                    <BarChart3 className="h-6 w-6" />
                    Resumen
                </CardTitle>
                <CardDescription>
                    Esta sección está actualmente en desarrollo.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">
                    Próximamente, aquí encontrarás estadísticas y resúmenes visuales de los datos recopilados.
                </p>
            </CardContent>
        </Card>
      </main>
    </div>
  );
}
