
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Header from "@/components/header";
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { type Dato, type ReportData, type ImageData } from '@/lib/data';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { Loader2, FileText, ImageIcon, Building, MapPin, Search, Download } from 'lucide-react';
import Image from 'next/image';
import { ImageViewerDialog } from '@/components/image-viewer-dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { capitalizeWords } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export default function FichaPage() {
  const { firestore } = useFirebase();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const datosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'datos') : null, [firestore]);
  const { data: datosData, isLoading: isLoadingDatos } = useCollection<Dato>(datosQuery);

  const [departments, setDepartments] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);

  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  
  const [departmentFromUrl, setDepartmentFromUrl] = useState<string | null>(null);
  const [districtFromUrl, setDistrictFromUrl] = useState<string | null>(null);
  
  const [shouldFetch, setShouldFetch] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const reportQuery = useMemoFirebase(() => {
    if (!firestore || !shouldFetch || !selectedDepartment || !selectedDistrict) return null;
    return query(
      collection(firestore, 'reports'),
      where('departamento', '==', selectedDepartment),
      where('distrito', '==', selectedDistrict)
    );
  }, [firestore, shouldFetch, selectedDepartment, selectedDistrict]);

  const imagesQuery = useMemoFirebase(() => {
    if (!firestore || !shouldFetch || !selectedDepartment || !selectedDistrict) return null;
    return query(
      collection(firestore, 'imagenes'),
      where('departamento', '==', selectedDepartment),
      where('distrito', '==', selectedDistrict)
    );
  }, [firestore, shouldFetch, selectedDepartment, selectedDistrict]);

  const { data: reportData, isLoading: isLoadingReport } = useCollection<ReportData>(reportQuery);
  const { data: imagesData, isLoading: isLoadingImages } = useCollection<ImageData>(imagesQuery);
  
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
  const [isViewerOpen, setViewerOpen] = useState(false);

  useEffect(() => {
    const dept = searchParams.get('dept');
    const dist = searchParams.get('dist');
    if (dept) setDepartmentFromUrl(decodeURIComponent(dept));
    if (dist) setDistrictFromUrl(decodeURIComponent(dist));
  }, [searchParams]);


  useEffect(() => {
    if (datosData) {
      const uniqueDepts = [...new Set(datosData.map(d => d.departamento))].sort();
      setDepartments(uniqueDepts);
      
      if(departmentFromUrl && uniqueDepts.includes(departmentFromUrl)) {
        setSelectedDepartment(departmentFromUrl);
      }
    }
  }, [datosData, departmentFromUrl]);

  useEffect(() => {
    if (selectedDepartment && datosData) {
      const uniqueDistricts = [...new Set(datosData.filter(d => d.departamento === selectedDepartment).map(d => d.distrito))].sort();
      setDistricts(uniqueDistricts);
      
       if (districtFromUrl && uniqueDistricts.includes(districtFromUrl)) {
          setSelectedDistrict(districtFromUrl);
          setShouldFetch(true);
          setDepartmentFromUrl(null);
          setDistrictFromUrl(null);
      }
    } else {
      setDistricts([]);
    }
  }, [selectedDepartment, datosData, districtFromUrl]);
  
  const handleDepartmentChange = (value: string) => {
    setSelectedDepartment(value);
    setSelectedDistrict(null);
    setShouldFetch(false);
  };
  
  const handleDistrictChange = (value: string) => {
    setSelectedDistrict(value);
    setShouldFetch(false);
  };

  const handleSearch = () => {
    if(selectedDepartment && selectedDistrict) {
      setShouldFetch(true);
    }
  };
  
  const handleOpenImageViewer = (image: ImageData) => {
    setSelectedImage(image);
    setViewerOpen(true);
  };

  const isLoading = isLoadingDatos || (shouldFetch && (isLoadingReport || isLoadingImages));
  const currentReport = reportData && reportData.length > 0 ? reportData[0] : null;

  const currentImageIndex = useMemo(() => {
    if (!selectedImage || !imagesData) return -1;
    return imagesData.findIndex(img => img.id === selectedImage.id);
  }, [selectedImage, imagesData]);

  const handleNextImage = () => {
    if (imagesData && currentImageIndex < imagesData.length - 1) {
      setSelectedImage(imagesData[currentImageIndex + 1]);
    }
  };

  const handlePreviousImage = () => {
    if (imagesData && currentImageIndex > 0) {
      setSelectedImage(imagesData[currentImageIndex - 1]);
    }
  };
  
  const handleGeneratePdf = async () => {
    if (!currentReport && (!imagesData || imagesData.length === 0)) {
        toast({
            variant: "destructive",
            title: "No hay datos para generar el PDF",
            description: "Asegúrate de que haya un informe o imágenes para la ubicación seleccionada."
        });
        return;
    }
    
    setIsGeneratingPdf(true);
    
    const doc = new jsPDF();
    let yPos = 20;

    // Title
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("Informe Edilicio", doc.internal.pageSize.getWidth() / 2, yPos, { align: 'center' });
    yPos += 10;
    
    // Subtitle
    doc.setFontSize(16);
    doc.setFont("helvetica", "normal");
    doc.text(`${selectedDepartment} - ${selectedDistrict}`, doc.internal.pageSize.getWidth() / 2, yPos, { align: 'center' });
    yPos += 15;

    // Report Data Table
    if (currentReport) {
        const reportBody = Object.entries(currentReport)
            .filter(([key, value]) => key !== 'id' && key !== 'departamento' && key !== 'distrito' && value)
            .map(([key, value]) => [capitalizeWords(key.replace(/-/g, ' ')), value]);
        
        autoTable(doc, {
            startY: yPos,
            head: [['Campo', 'Valor']],
            body: reportBody,
            theme: 'striped',
            headStyles: { fillColor: [41, 128, 185] },
            didDrawPage: (data) => {
              yPos = data.cursor?.y ?? yPos;
            }
        });
        yPos += 10;
    }

    // Images Section
    if (imagesData && imagesData.length > 0) {
        const checkAndAddPage = (neededHeight: number) => {
            if (yPos + neededHeight > doc.internal.pageSize.getHeight() - 20) {
                doc.addPage();
                yPos = 20;
            }
        };

        yPos += 5;
        checkAndAddPage(10);
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text("Imágenes Adjuntas", 14, yPos);
        yPos += 10;

        for (const image of imagesData) {
            try {
                const img = new window.Image();
                img.src = image.src;
                img.crossOrigin = "Anonymous";

                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                });
                
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0);
                const dataUrl = canvas.toDataURL('image/jpeg');

                const imgProps = doc.getImageProperties(dataUrl);
                const imgWidth = 180;
                const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
                
                checkAndAddPage(imgHeight + 15);
                
                doc.setFontSize(10);
                doc.setFont("helvetica", "italic");
                doc.text(image.alt, 14, yPos);
                yPos += 5;
                
                doc.addImage(dataUrl, 'JPEG', 14, yPos, imgWidth, imgHeight);
                yPos += imgHeight + 10;

            } catch (error) {
                console.error("Error al procesar imagen para PDF:", error);
                checkAndAddPage(15);
                doc.setFontSize(10);
                doc.setTextColor(255, 0, 0);
                doc.text(`Error al cargar la imagen: ${image.alt}`, 14, yPos);
                doc.setTextColor(0, 0, 0);
                yPos += 10;
            }
        }
    }

    doc.save(`Informe_${selectedDepartment}_${selectedDistrict}.pdf`);
    setIsGeneratingPdf(false);
  };

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header title="Vista de Ficha" />
      <main className="flex flex-1 flex-col p-4 md:p-6 lg:p-8 gap-8">
        <Card className="w-full max-w-6xl mx-auto">
          <CardHeader>
            <CardTitle>Filtro de Búsqueda</CardTitle>
            <CardDescription>Selecciona un departamento y distrito para ver los detalles.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="space-y-2">
                <label className="text-sm font-medium">Departamento</label>
                <Select onValueChange={handleDepartmentChange} value={selectedDepartment || ''} disabled={isLoadingDatos}>
                  <SelectTrigger>
                    <SelectValue placeholder={isLoadingDatos ? 'Cargando...' : 'Selecciona un departamento'} />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map(dept => <SelectItem key={dept} value={dept}>{dept}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Distrito</label>
                <Select onValueChange={handleDistrictChange} value={selectedDistrict || ''} disabled={!selectedDepartment}>
                  <SelectTrigger>
                    <SelectValue placeholder={!selectedDepartment ? 'Primero selecciona un dpto.' : 'Selecciona un distrito'} />
                  </SelectTrigger>
                  <SelectContent>
                    {districts.map(dist => <SelectItem key={dist} value={dist}>{dist}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSearch} disabled={!selectedDepartment || !selectedDistrict || isLoading} className="w-full md:w-auto">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                Buscar
              </Button>
            </div>
          </CardContent>
        </Card>
        
        {isLoading && (
            <div className="flex justify-center items-center py-10">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        )}

        {shouldFetch && !isLoading && (
            <>
                {!currentReport && (!imagesData || imagesData.length === 0) ? (
                    <Card className="w-full max-w-6xl mx-auto">
                        <CardContent className="py-10 text-center text-muted-foreground">
                            No se encontraron datos para la ubicación seleccionada.
                        </CardContent>
                    </Card>
                ) : (
                <div className="w-full max-w-6xl mx-auto space-y-8">
                  {currentReport && (
                    <Card>
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="flex items-center gap-3">
                              <FileText className="h-6 w-6 text-primary" />
                              <span>Informe del Distrito</span>
                            </CardTitle>
                            <CardDescription>{selectedDepartment} - {selectedDistrict}</CardDescription>
                          </div>
                          <Button onClick={handleGeneratePdf} disabled={isGeneratingPdf}>
                              {isGeneratingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                              Generar PDF
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                            <InfoItem label="Estado Físico" value={currentReport['estado-fisico']} icon={Building} />
                            <InfoItem label="Cantidad de Habitaciones" value={currentReport['cantidad-habitaciones']} />
                            <InfoItem label="Habitación Segura" value={currentReport['habitacion-segura']} />
                            <InfoItem label="Dimensiones Habitación" value={currentReport['dimensiones-habitacion']} />
                            <InfoItem label="Cantidad de Máquinas" value={currentReport['cantidad-maquinas']} />
                            <InfoItem label="Lugar de Resguardo" value={currentReport['lugar-resguardo']} icon={MapPin} />
                            <InfoItem label="Descripción" value={currentReport['descripcion-situacion']} fullWidth />
                            <InfoItem label="Características Habitación" value={currentReport['caracteristicas-habitacion']} fullWidth />
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  
                  {imagesData && imagesData.length > 0 && (
                     <Card>
                       <CardHeader>
                        <CardTitle className="flex items-center gap-3">
                          <ImageIcon className="h-6 w-6 text-primary" />
                          <span>Imágenes</span>
                        </CardTitle>
                        <CardDescription>Imágenes asociadas a {selectedDistrict}</CardDescription>
                      </CardHeader>
                      <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {imagesData.map(image => (
                          <Card key={image.id} className="overflow-hidden cursor-pointer group" onClick={() => handleOpenImageViewer(image)}>
                            <div className="relative aspect-video">
                              <Image src={image.src} alt={image.alt} fill className="object-cover transition-transform group-hover:scale-105" data-ai-hint={image.hint} />
                            </div>
                          </Card>
                        ))}
                      </CardContent>
                     </Card>
                  )}
                </div>
                )}
            </>
        )}
      </main>
       <ImageViewerDialog 
        isOpen={isViewerOpen} 
        onOpenChange={setViewerOpen} 
        image={selectedImage}
        onNext={handleNextImage}
        onPrevious={handlePreviousImage}
        canNavigateNext={imagesData ? currentImageIndex < imagesData.length - 1 : false}
        canNavigatePrevious={currentImageIndex > 0}
      />
    </div>
  );
}


function InfoItem({ label, value, icon: Icon, fullWidth = false }: { label: string, value?: string, icon?: React.ElementType, fullWidth?: boolean }) {
    if (!value) return null;
    return (
        <div className={fullWidth ? 'md:col-span-2' : ''}>
            <div className="flex items-center space-x-2 text-sm font-semibold text-muted-foreground">
              {Icon && <Icon className="h-4 w-4" />}
              <span>{label}</span>
            </div>
            <p className="mt-1 text-base text-foreground bg-muted/50 p-2 rounded-md">{value}</p>
        </div>
    );
}

