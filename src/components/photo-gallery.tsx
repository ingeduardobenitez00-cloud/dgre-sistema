"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, ImageIcon } from 'lucide-react';
import { type Department, type ImageData } from '@/lib/data';
import { UploadDialog } from '@/components/upload-dialog';
import { ImageViewerDialog } from '@/components/image-viewer-dialog';

export default function PhotoGallery() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
  const [isUploadOpen, setUploadOpen] = useState(false);
  const [activeDistrict, setActiveDistrict] = useState<{deptId: string, distId: string} | null>(null);

  useEffect(() => {
    // On component mount, check for imported data in localStorage
    const storedData = localStorage.getItem('imported_departments');
    if (storedData) {
      try {
        const importedDepartments = JSON.parse(storedData);
        setDepartments(importedDepartments);
      } catch (error) {
        console.error("Failed to parse imported departments from localStorage", error);
      }
    }
  }, []);

  const handleOpenUpload = (deptId: string, distId: string) => {
    setActiveDistrict({ deptId, distId });
    setUploadOpen(true);
  };

  const handleImagesUploaded = (newImages: ImageData[]) => {
    if (!activeDistrict) return;
    
    const updatedDepartments = departments.map(dept => 
      dept.id === activeDistrict.deptId
        ? {
            ...dept,
            districts: dept.districts.map(dist => 
              dist.id === activeDistrict.distId
                ? { ...dist, images: [...dist.images, ...newImages] }
                : dist
            ),
          }
        : dept
    );

    setDepartments(updatedDepartments);
    localStorage.setItem('imported_departments', JSON.stringify(updatedDepartments));
    setUploadOpen(false);
  };

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Galería de Fotos
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          Explore y gestione las imágenes de los registros organizadas por ubicación.
        </p>
      </div>

      <Accordion type="single" collapsible className="w-full">
        {departments.map((department) => (
          <AccordionItem value={department.id} key={department.id}>
            <AccordionTrigger className="text-lg font-medium hover:no-underline data-[state=open]:text-primary">
              {department.name}
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-6 pl-4">
                {department.districts.map((district) => (
                  <div key={district.id}>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-md font-medium text-foreground/90">{district.name}</h3>
                      <Button variant="outline" size="sm" onClick={() => handleOpenUpload(department.id, district.id)}>
                        <Upload className="mr-2 h-4 w-4" />
                        Subir Foto
                      </Button>
                    </div>
                    {district.images.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {district.images.map((image) => (
                          <Card
                            key={image.id}
                            className="overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]"
                            onClick={() => setSelectedImage(image)}
                          >
                            <CardContent className="p-0">
                              <Image
                                src={image.src}
                                alt={image.alt}
                                width={600}
                                height={400}
                                className="aspect-[3/2] w-full object-cover"
                                data-ai-hint={image.hint}
                              />
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <button 
                        onClick={() => handleOpenUpload(department.id, district.id)}
                        className="w-full text-center py-12 border-2 border-dashed rounded-lg flex flex-col items-center justify-center hover:bg-muted/50 transition-colors"
                      >
                        <ImageIcon className="h-8 w-8 text-muted-foreground mb-2"/>
                        <p className="text-muted-foreground font-medium">No hay imágenes en este distrito.</p>
                        <p className="text-sm text-muted-foreground">Haz clic aquí para subir una.</p>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <UploadDialog
        isOpen={isUploadOpen}
        onOpenChange={setUploadOpen}
        onImagesUploaded={handleImagesUploaded}
      />

      <ImageViewerDialog
        isOpen={!!selectedImage}
        onOpenChange={() => setSelectedImage(null)}
        image={selectedImage}
      />
    </div>
  );
}
