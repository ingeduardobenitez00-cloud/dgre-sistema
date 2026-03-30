
'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw, AlertCircle, ShieldAlert } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Registro técnico del error para auditoría silenciosa
    console.error('SISTEMA - ERROR CRÍTICO DETECTADO:', error)
    
    // Si es un error de carga de componentes (común tras publicar), recargamos automáticamente
    if (error.message?.toLowerCase().includes('chunk') || error.message?.toLowerCase().includes('loading')) {
        window.location.reload();
    }
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-[#F8F9FA] text-center">
      <div className="max-w-md w-full animate-in fade-in zoom-in duration-500">
        <div className="h-24 w-24 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-8 border-4 border-destructive/20 shadow-lg">
            <ShieldAlert className="h-12 w-12 text-destructive" />
        </div>
        
        <div className="space-y-4 mb-10">
            <h1 className="text-2xl font-black uppercase text-primary tracking-tight leading-none">Error de Versión</h1>
            <p className="text-xs font-bold uppercase text-muted-foreground leading-relaxed px-4">
                Se han detectado actualizaciones recientes en el sistema que requieren una sincronización de memoria en su dispositivo.
            </p>
        </div>

        <div className="bg-white p-8 border-2 rounded-[2rem] shadow-2xl space-y-6">
            <Button 
                onClick={() => {
                    // Forzar recarga total ignorando la caché del navegador
                    window.location.href = window.location.origin + window.location.pathname + '?v=' + Date.now();
                }} 
                className="w-full h-16 bg-black hover:bg-black/90 text-white font-black uppercase text-sm shadow-xl gap-3 rounded-2xl"
            >
                <RefreshCw className="h-5 w-5" />
                Sincronizar y Reiniciar
            </Button>
            
            <div className="flex items-center gap-3 bg-muted/30 p-4 rounded-xl text-left border">
                <AlertCircle className="h-5 w-5 text-primary opacity-40 shrink-0" />
                <p className="text-[10px] font-medium uppercase text-muted-foreground italic">
                    Esta acción instalará la última versión del sistema y corregirá cualquier error de navegación automáticamente.
                </p>
            </div>
        </div>

        <footer className="mt-12 opacity-40">
            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">
                Justicia Electoral - República del Paraguay - 2026
            </p>
        </footer>
      </div>
    </div>
  )
}
