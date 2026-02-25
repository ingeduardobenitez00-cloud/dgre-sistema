
'use client';

import { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Importación diferida de estilos de geosearch para evitar conflictos de carga
import 'leaflet-geosearch/dist/geosearch.css';

interface MapModuleProps {
  onLocationSelect: (lat: number, lng: number) => void;
}

export default function MapModule({ onLocationSelect }: MapModuleProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLocationFixed, setIsLocationFixed] = useState(false);
  const [coords, setCoords] = useState<string>('');
  const [isMapLoading, setIsMapLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return;

    let mounted = true;

    const initMap = async () => {
      try {
        // Carga dinámica de las librerías de búsqueda para manejar errores de carga
        const { GeoSearchControl, OpenStreetMapProvider } = await import('leaflet-geosearch');

        if (!mounted || !containerRef.current) return;

        // FIX CRÍTICO: Soluciona el problema de los iconos de marcador rotos en Next.js
        // @ts-ignore
        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
        });

        // Limpiar instancia previa si existe
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }

        // Inicializar Mapa con DoubleClickZoom DESACTIVADO para permitir marcación exacta
        const map = L.map(containerRef.current, {
          center: [-25.3006, -57.6359], // Justicia Electoral Asunción
          zoom: 13,
          zoomControl: true,
          attributionControl: false,
          doubleClickZoom: false 
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

        // Configurar Buscador con manejo de errores silencioso
        const provider = new OpenStreetMapProvider();
        const searchControl = new (GeoSearchControl as any)({
          provider,
          style: 'bar',
          showMarker: false,
          autoClose: true,
          searchLabel: 'Buscar dirección...',
          keepResult: true,
          updateMap: true,
          notFoundMessage: 'No se encontró la ubicación.',
        });
        
        map.addControl(searchControl);

        // Captura por Doble Clic REFORZADA
        map.on('dblclick', (e: L.LeafletMouseEvent) => {
          const { lat, lng } = e.latlng;
          
          if (markerRef.current) {
            map.removeLayer(markerRef.current);
          }
          
          markerRef.current = L.marker([lat, lng]).addTo(map);
          
          onLocationSelect(lat, lng);
          setIsLocationFixed(true);
          setCoords(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
          
          map.panTo([lat, lng]);
        });

        mapRef.current = map;
        
        // Ciclo de sincronización para eliminar el "cuadro gris"
        setTimeout(() => map.invalidateSize(), 100);
        setTimeout(() => map.invalidateSize(), 500);
        
        setIsMapLoading(false);
      } catch (err) {
        console.error("Error al inicializar los servicios del mapa:", err);
        setIsMapLoading(false);
      }
    };

    initMap();

    return () => {
      mounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [onLocationSelect]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 px-2">
        <div className="h-8 w-8 rounded-lg bg-black text-white flex items-center justify-center shadow-lg">
          <MapPin className="h-4 w-4" />
        </div>
        <h2 className="text-xl font-black uppercase tracking-tight text-primary">GEORREFERENCIACIÓN DEL EVENTO</h2>
      </div>

      <Separator className="bg-muted-foreground/10" />

      <div className="p-5 bg-[#F3F4F6] border-2 border-dashed border-muted-foreground/20 rounded-2xl text-center">
        <p className="text-[10px] font-black uppercase tracking-widest leading-tight">
          DOBLE CLIC EN EL MAPA PARA CAPTURAR COORDENADAS EXACTAS
        </p>
      </div>

      <div className="relative group min-h-[400px]">
        {isMapLoading && (
          <div className="absolute inset-0 z-20 bg-muted/10 animate-pulse flex flex-col items-center justify-center gap-3 rounded-[2rem]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/40" />
            <span className="text-[10px] font-black uppercase text-muted-foreground/40 tracking-widest">Preparando Servicios...</span>
          </div>
        )}
        <div className="absolute inset-0 bg-primary/5 rounded-[2rem] blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
        <div 
          className="map-view-container border-4 border-white shadow-2xl relative z-10 overflow-hidden" 
          ref={containerRef} 
          style={{ height: '400px', borderRadius: '2rem' }}
        ></div>
      </div>

      <div className="p-6 bg-[#F3F4F6] rounded-[2.5rem] flex items-center gap-6 shadow-inner border border-muted-foreground/5">
        <div className="h-14 w-14 rounded-full bg-white flex items-center justify-center shadow-md">
          <Navigation className={cn("h-6 w-6 transition-colors", isLocationFixed ? "text-green-600" : "text-muted-foreground/40")} />
        </div>
        <div className="flex flex-col">
          <span className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-1">COORDENADAS GPS</span>
          <span className={cn(
            "text-sm font-black uppercase tracking-tighter",
            isLocationFixed ? "text-green-600" : "text-[#1A1A1A]"
          )}>
            {isLocationFixed ? coords : "PENDIENTE DE CAPTURA"}
          </span>
        </div>
      </div>
    </div>
  );
}
