
"use client";

import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ImageData } from '@/lib/data';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cleanFileName } from '@/lib/utils';
import { useState, useRef, type MouseEvent } from 'react';
import { ZoomIn, ZoomOut, Search, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';


type ImageViewerDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  image: ImageData | null;
  onNext?: () => void;
  onPrevious?: () => void;
  canNavigateNext?: boolean;
  canNavigatePrevious?: boolean;
};

export function ImageViewerDialog({
  isOpen,
  onOpenChange,
  image,
  onNext,
  onPrevious,
  canNavigateNext = false,
  canNavigatePrevious = false,
}: ImageViewerDialogProps) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const imageRef = useRef<HTMLDivElement>(null);
  const startPos = useRef({ x: 0, y: 0 });

  const resetState = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setIsDragging(false);
  };
  
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetState();
    }
    onOpenChange(open);
  }

  if (!image) return null;
  
  const cleanedTitle = cleanFileName(image.alt);

  const handleZoomIn = () => setScale(s => Math.min(s + 0.2, 3));
  const handleZoomOut = () => {
    const newScale = Math.max(scale - 0.2, 1);
    if(newScale === 1) {
        setOffset({ x: 0, y: 0 });
    }
    setScale(newScale);
  };
  const handleResetZoom = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };
  
  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (scale > 1) {
      setIsDragging(true);
      startPos.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
      e.currentTarget.style.cursor = 'grabbing';
    }
  };

  const handleMouseUp = (e: MouseEvent<HTMLDivElement>) => {
    setIsDragging(false);
    e.currentTarget.style.cursor = 'grab';
  };
  
  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (isDragging && imageRef.current) {
        const newX = e.clientX - startPos.current.x;
        const newY = e.clientY - startPos.current.y;
        
        const { width, height } = imageRef.current.getBoundingClientRect();
        const maxOffsetX = ((width * scale) - width) / 2;
        const maxOffsetY = ((height * scale) - height) / 2;

        setOffset({
            x: Math.max(-maxOffsetX, Math.min(maxOffsetX, newX)),
            y: Math.max(-maxOffsetY, Math.min(maxOffsetY, newY)),
        });
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>{cleanedTitle}</DialogTitle>
          <DialogDescription>
            {image.alt}
          </DialogDescription>
        </DialogHeader>
        <div 
            className="flex-1 relative overflow-hidden bg-muted/20"
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseUp}
            ref={imageRef}
            style={{ cursor: scale > 1 ? 'grab' : 'default' }}
        >
            <Image
              src={image.src}
              alt={image.alt}
              fill
              className="object-contain transition-transform duration-200"
              style={{
                transform: `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px)`,
              }}
              data-ai-hint={image.hint}
            />

            {onPrevious && (
                 <Button
                    variant="ghost"
                    size="icon"
                    onClick={onPrevious}
                    disabled={!canNavigatePrevious}
                    className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 text-white hover:bg-black/75 hover:text-white disabled:opacity-30 h-10 w-10"
                >
                    <ChevronLeft className="h-6 w-6" />
                </Button>
            )}
            {onNext && (
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onNext}
                    disabled={!canNavigateNext}
                    className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 text-white hover:bg-black/75 hover:text-white disabled:opacity-30 h-10 w-10"
                >
                    <ChevronRight className="h-6 w-6" />
                </Button>
            )}

        </div>
         <DialogFooter className="bg-muted/50 p-3 flex-row justify-center sm:justify-center border-t">
            <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={handleZoomOut} disabled={scale <= 1}>
                    <ZoomOut className="h-5 w-5" />
                </Button>
                <Button variant="outline" size="icon" onClick={handleZoomIn} disabled={scale >= 3}>
                    <ZoomIn className="h-5 w-5" />
                </Button>
                <Button variant="outline" size="icon" onClick={handleResetZoom} disabled={scale === 1}>
                    <RefreshCw className="h-5 w-5" />
                </Button>
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
