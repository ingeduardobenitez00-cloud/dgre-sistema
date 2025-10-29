"use client";

import { useState, useTransition, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar as CalendarIcon, Loader2, Sparkles, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { ImageData } from '@/lib/data';
import { imageAutoTagging } from '@/lib/actions';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';

type UploadDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onImagesUploaded: (newImages: Omit<ImageData, 'id' | 'departamento' | 'distrito'>[]) => void;
};

type FilePreview = {
  id: string;
  file: File;
  previewUrl: string;
  tags: string;
  isTagging: boolean;
  category: string;
  date: Date;
};

export function UploadDialog({ isOpen, onOpenChange, onImagesUploaded }: UploadDialogProps) {
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [isSubmitting, startTransition] = useTransition();
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles) return;

    const newFilePreviews: FilePreview[] = Array.from(selectedFiles).map(file => ({
      id: `${file.name}-${file.lastModified}`,
      file,
      previewUrl: '',
      tags: '',
      isTagging: true,
      category: 'Fachada',
      date: new Date(),
    }));
    
    setFiles(prev => [...prev, ...newFilePreviews]);

    newFilePreviews.forEach((filePreview) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement('img');
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
          
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const dataUri = canvas.toDataURL(filePreview.file.type, 0.7);

            setFiles(prev => prev.map(f => f.id === filePreview.id ? { ...f, previewUrl: dataUri } : f));
            
            handleTagGeneration(dataUri, filePreview.id);

          } else {
             toast({ variant: 'destructive', title: 'Error', description: `No se pudo procesar la imagen: ${filePreview.file.name}.` });
          }
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(filePreview.file);
    });
  };

  const handleTagGeneration = async (photoDataUri: string, fileId: string) => {
    const result = await imageAutoTagging({ photoDataUri });
    
    setFiles(prev => prev.map(f => {
      if (f.id === fileId) {
        if ('tags' in result) {
          return { ...f, tags: result.tags.join(', '), isTagging: false };
        } else {
          toast({
            variant: 'destructive',
            title: 'Error de IA',
            description: `No se pudieron generar las etiquetas para ${f.file.name}.`,
          });
          return { ...f, isTagging: false };
        }
      }
      return f;
    }));
  };
  
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (files.length === 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Por favor, selecciona al menos una imagen.' });
      return;
    }
    startTransition(() => {
      const newImages: Omit<ImageData, 'id' | 'departamento' | 'distrito'>[] = files.map(f => ({
        src: f.previewUrl,
        alt: f.file.name,
        tags: f.tags.split(',').map(tag => tag.trim()).filter(Boolean),
        date: format(f.date, 'yyyy-MM-dd'),
        category: f.category,
        hint: f.tags.split(',')[0] || 'building'
      }));

      onImagesUploaded(newImages);
      resetForm();
    });
  };

  const resetForm = () => {
    setFiles([]);
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    onOpenChange(open);
  }

  const allFilesProcessed = files.every(f => f.previewUrl && !f.isTagging);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px] md:max-w-2xl lg:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Subir Nuevas Imágenes</DialogTitle>
          <DialogDescription>
            Selecciona una o varias imágenes. La IA sugerirá etiquetas para cada una.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-6 py-4">
          <div className="space-y-2">
             <label
                htmlFor="picture"
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 mb-3 text-muted-foreground" />
                  <p className="mb-2 text-sm text-muted-foreground">
                    <span className="font-semibold">Haz clic para subir</span> o arrastra y suelta
                  </p>
                  <p className="text-xs text-muted-foreground">Puedes seleccionar varias imágenes</p>
                </div>
                <Input id="picture" type="file" onChange={handleFileChange} accept="image/*" multiple className="hidden"/>
              </label>
          </div>

          {files.length > 0 && (
            <ScrollArea className="h-[450px] w-full pr-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {files.map((file, index) => (
                    <Card key={file.id} className="overflow-hidden">
                        <CardContent className="p-2 space-y-2">
                             <div className="relative aspect-video w-full overflow-hidden rounded-md">
                                {file.previewUrl ? (
                                    <Image src={file.previewUrl} alt={`Vista previa de ${file.file.name}`} fill style={{ objectFit: 'cover' }} />
                                ) : (
                                    <div className="w-full h-full bg-muted flex items-center justify-center">
                                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/>
                                    </div>
                                )}
                            </div>
                            <div className="p-2 space-y-4">
                                <div className="space-y-1">
                                    <Label htmlFor={`tags-${index}`} className="text-xs flex items-center mb-1">
                                        Etiquetas
                                        {file.isTagging && <Loader2 className="ml-2 h-3 w-3 animate-spin" />}
                                        {!file.isTagging && <Sparkles className="ml-2 h-3 w-3 text-accent" />}
                                    </Label>
                                    <Input 
                                        id={`tags-${index}`} 
                                        value={file.tags}
                                        onChange={(e) => {
                                            const newFiles = [...files];
                                            newFiles[index].tags = e.target.value;
                                            setFiles(newFiles);
                                        }}
                                        disabled={file.isTagging}
                                        className="h-8 text-xs"
                                    />
                                </div>
                                <div className='grid grid-cols-2 gap-4'>
                                    <div className="space-y-1">
                                        <Label htmlFor={`category-${index}`} className="text-xs">Categoría</Label>
                                        <Select 
                                            value={file.category}
                                            onValueChange={(value) => setFiles(fs => fs.map(f => f.id === file.id ? {...f, category: value} : f))}
                                        >
                                            <SelectTrigger id={`category-${index}`} className="h-8 text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Fachada">Fachada</SelectItem>
                                                <SelectItem value="Interior">Interior</SelectItem>
                                                <SelectItem value="Infraestructura">Infraestructura</SelectItem>
                                                <SelectItem value="Documento">Documento</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                     <div className="space-y-1">
                                        <Label htmlFor={`date-${index}`} className="text-xs">Fecha</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    id={`date-${index}`}
                                                    variant={"outline"}
                                                    className={cn(
                                                        "w-full justify-start text-left font-normal h-8 text-xs",
                                                        !file.date && "text-muted-foreground"
                                                    )}
                                                >
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {file.date ? format(file.date, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
                                                <Calendar
                                                    mode="single"
                                                    selected={file.date}
                                                    onSelect={(date) => date && setFiles(fs => fs.map(f => f.id === file.id ? {...f, date} : f))}
                                                    initialFocus
                                                    locale={es}
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
                </div>
            </ScrollArea>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={files.length === 0 || !allFilesProcessed || isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Subir {files.length > 0 ? `${files.length} imágen${files.length > 1 ? 'es' : ''}` : 'Imágenes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
