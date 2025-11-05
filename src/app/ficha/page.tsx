"use client";

import { Card, CardContent } from "@/components/ui/card";
import Header from "@/components/header";

export default function FichaPage() {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header title="Vista de Ficha" />
      <main className="flex flex-1 flex-col p-4 gap-8">
        <Card className="w-full max-w-6xl mx-auto">
          <CardContent className="p-6">
            <h1 className="text-2xl font-semibold mb-4">Datos de la Ficha</h1>
            <p>Contenido de ejemplo dentro de la ficha.</p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
