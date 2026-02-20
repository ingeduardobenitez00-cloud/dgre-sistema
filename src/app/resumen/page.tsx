
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useFirebase, useMemoFirebase, useUser } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection } from 'firebase/firestore';
import { type Dato, type ReportData } from '@/lib/data';
import { Loader2, Building, CheckCircle, Shield, FileText, Landmark, Vote, Scale, Home, HelpCircle, Download } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cleanFileName } from '@/lib/utils';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

type DistrictWithReport = {
  name: string;
  report: ReportData | null;
};

type DepartmentWithDistricts = {
  id: string;
  name: string;
  districts: DistrictWithReport[];
};

type CategoryDistrictInfo = {
    displayName: string;
    departamento: string;
    distrito: string;
};

type CategoryData = {
    count: number;
    districts: CategoryDistrictInfo[];
    reports: ReportData[];
}

type SummaryData = {
    totalReports: CategoryData;
    habitacionSegura: CategoryData;
    comisaria: CategoryData;
    parroquia: CategoryData;
    localVotacion: CategoryData;
    juzgado: CategoryData;
    propiedadIntendencia: CategoryData;
    otrosNoEspecificado: CategoryData;
};

type DistrictInfoForBreakdown = {
    name: string;
    code?: string;
    deptCode?: string;
    deptName: string;
}

type BreakdownData = {
    [department: string]: DistrictInfoForBreakdown[];
}

const ResguardoIcon = ({ lugar }: { lugar: string | undefined }) => {
  const normalizedLugar = lugar ? lugar.toLowerCase() : '';
  if (normalizedLugar.includes('habitacion segura') || normalizedLugar.includes('registro')) {
    return <CheckCircle className="h-5 w-5 text-green-600" title="Habitación Segura / Registro" />;
  }
  if (normalizedLugar.includes('comisaria')) {
    return <Shield className="h-5 w-5 text-blue-600" title="Comisaría" />;
  }
  return <Building className="h-5 w-5 text-muted-foreground" title="Otro Lugar" />;
};

export default function ResumenPage() {
  const { firestore } = useFirebase();
  const { user: currentUser, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const datosQuery = useMemoFirebase(() => firestore ? collection(firestore, 'datos') : null, [firestore]);
  const { data: datosData, isLoading: isLoadingDatos } = useCollection<Dato>(datosQuery);
  
  const reportsQuery = useMemoFirebase(() => {
    if (!firestore || !currentUser) return null;
    return collection(firestore, 'reports');
  }, [firestore, currentUser]);
  
  const { data: reportsData, isLoading: isLoadingReports } = useCollection<ReportData>(reportsQuery);

  const [structuredData, setStructuredData] = useState<DepartmentWithDistricts[]>([]);
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [comisariaData, setComisariaData] = useState<BreakdownData>({});
  const [habitacionSeguraData, setHabitacionSeguraData] = useState<BreakdownData>({});

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [districtsForCategory, setDistrictsForCategory] = useState<CategoryDistrictInfo[]>([]);
  
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [logo1Base64, setLogo1Base64] = useState<string | null>(null);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  const canGeneratePdf = currentUser?.profile?.role === 'admin' || currentUser?.profile?.permissions?.includes('generar_pdf');

  useEffect(() => {
    const fetchLogo = async (path: string, setter: (data: string | null) => void) => {
        try {
            const response = await fetch(path);
            const blob = await response.blob();
            const reader = new FileReader();
            reader.onloadend = () => setter(reader.result as string);
            reader.readAsDataURL(blob);
        } catch (error) {
            console.error(`Error fetching logo ${path}:`, error);
        }
    };
    fetchLogo('/logo1.png', setLogo1Base64);
    fetchLogo('/logo.png', setLogoBase64);
  }, []);

  useEffect(() => {
    if (datosData && reportsData) {
      const departments: Record<string, Set<string>> = {};
      datosData.forEach(d => {
        if (!departments[d.departamento]) {
          departments[d.departamento] = new Set();
        }
        departments[d.departamento].add(d.distrito);
      });

      let deptIdCounter = 0;
      const structured: DepartmentWithDistricts[] = Object.keys(departments).sort().map(deptName => {
        const districts = Array.from(departments[deptName]).sort();
        const districtsWithReports: DistrictWithReport[] = districts.map(distName => {
          const report = reportsData.find(r => r.departamento === deptName && r.distrito === distName) || null;
          return { name: distName, report };
        });
        return { id: `dept-${deptIdCounter++}`, name: deptName, districts: districtsWithReports };
      });
      setStructuredData(structured);
      
      const initialCategoryData = (): CategoryData => ({ count: 0, districts: [], reports: [] });
      const summary: SummaryData = {
        totalReports: initialCategoryData(),
        habitacionSegura: initialCategoryData(),
        comisaria: initialCategoryData(),
        parroquia: initialCategoryData(),
        localVotacion: initialCategoryData(),
        juzgado: initialCategoryData(),
        propiedadIntendencia: initialCategoryData(),
        otrosNoEspecificado: initialCategoryData(),
      };
      
      summary.totalReports.count = reportsData.length;
      summary.totalReports.districts = reportsData.map(r => ({ displayName: `${r.departamento} - ${r.distrito}`, departamento: r.departamento!, distrito: r.distrito! }));
      summary.totalReports.reports = reportsData;

      reportsData.forEach(report => {
        if (!report.departamento || !report.distrito) return;
        const lugar = report['lugar-resguardo'] ? report['lugar-resguardo'].toLowerCase().trim() : '';
        const districtInfo: CategoryDistrictInfo = {
            displayName: `${report.departamento} - ${report.distrito}`,
            departamento: report.departamento,
            distrito: report.distrito,
        };
        
        if (lugar.includes('habitacion') || lugar.includes('segura') || lugar.includes('registro')) {
            summary.habitacionSegura.count++;
            summary.habitacionSegura.districts.push(districtInfo);
            summary.habitacionSegura.reports.push(report);
        } else if (lugar.includes('comisaria')) {
            summary.comisaria.count++;
            summary.comisaria.districts.push(districtInfo);
            summary.comisaria.reports.push(report);
        } else if (lugar.includes('parroquia')) {
            summary.parroquia.count++;
            summary.parroquia.districts.push(districtInfo);
            summary.parroquia.reports.push(report);
        } else if (lugar.includes('local de votacion') || lugar.includes('local votacion')) {
            summary.localVotacion.count++;
            summary.localVotacion.districts.push(districtInfo);
            summary.localVotacion.reports.push(report);
        } else if (lugar.includes('juzgado')) {
            summary.juzgado.count++;
            summary.juzgado.districts.push(districtInfo);
            summary.juzgado.reports.push(report);
        } else if (lugar.includes('intendencia')) {
            summary.propiedadIntendencia.count++;
            summary.propiedadIntendencia.districts.push(districtInfo);
            summary.propiedadIntendencia.reports.push(report);
        } else {
            summary.otrosNoEspecificado.count++;
            summary.otrosNoEspecificado.districts.push(districtInfo);
            summary.otrosNoEspecificado.reports.push(report);
        }
      });
      setSummaryData(summary);
    }
  }, [datosData, reportsData]);

  useEffect(() => {
    if (reportsData && datosData) {
        const comisariaSummary: BreakdownData = {};
        const habitacionSeguraSummary: BreakdownData = {};
        const datosMap = new Map<string, { deptCode?: string, distCode?: string }>();
        datosData.forEach(dato => {
            const key = `${dato.departamento}-${dato.distrito}`;
            if (!datosMap.has(key)) {
                datosMap.set(key, { deptCode: dato.departamento_codigo, distCode: dato.distrito_codigo });
            }
        });

        reportsData.forEach(report => {
            const lugar = report['lugar-resguardo'] ? report['lugar-resguardo'].toLowerCase().trim() : '';
            const deptName = report.departamento;
            const distName = report.distrito;
            if (!deptName || !distName) return;
            const districtKey = `${deptName}-${distName}`;
            const datoInfo = datosMap.get(districtKey);
            const info = { name: distName, code: datoInfo?.distCode, deptCode: datoInfo?.deptCode, deptName: deptName };
            
            if (lugar.includes('habitacion') || lugar.includes('segura') || lugar.includes('registro')) {
                if (!habitacionSeguraSummary[deptName]) habitacionSeguraSummary[deptName] = [];
                habitacionSeguraSummary[deptName].push(info);
            } else if (lugar.includes('comisaria')) {
                if (!comisariaSummary[deptName]) comisariaSummary[deptName] = [];
                comisariaSummary[deptName].push(info);
            }
        });
        setComisariaData(comisariaSummary);
        setHabitacionSeguraData(habitacionSeguraSummary);
    }
}, [reportsData, datosData]);

const handleGeneratePdf = async () => {
    if (!structuredData || !summaryData || !logo1Base64 || !logoBase64) return;
    setIsGeneratingPdf(true);
    try {
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' }) as jsPDFWithAutoTable;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 15;
        const addHeader = () => {
            if (logo1Base64) doc.addImage(logo1Base64, 'PNG', margin, 10, 20, 20);
            if (logoBase64) doc.addImage(logoBase64, 'PNG', pageWidth - margin - 20, 10, 20, 20);
            doc.setFontSize(16); doc.setFont('helvetica', 'bold');
            doc.text("Informe Detallado por Ubicación", pageWidth / 2, 22, { align: 'center' });
        };
        const addFooter = (data: any) => {
            doc.setFontSize(10); doc.text(`Página ${data.pageNumber}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        };
        let finalBody: any[] = [];
        structuredData.forEach(department => {
             finalBody.push([{ content: `Departamento: ${department.name.toUpperCase()}`, colSpan: 2, styles: { fontStyle: 'bold', halign: 'left', fillColor: [230, 230, 230] } }]);
            department.districts.forEach(district => {
                finalBody.push([district.name, district.report ? district.report['lugar-resguardo'] || 'N/A' : 'Sin informe']);
            });
        });
        autoTable(doc, {
            head: [['Distrito', 'Lugar de Resguardo']],
            body: finalBody,
            startY: 35,
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
            didDrawPage: (data) => { addHeader(); addFooter(data); },
            margin: { top: 35, bottom: 20 }
        });
        doc.save(`Informe-Resumen-Detallado.pdf`);
    } catch (error) {
        toast({ title: 'Error', description: 'No se pudo generar el PDF.', variant: 'destructive' });
    } finally { setIsGeneratingPdf(false); }
};

  const handleCategoryClick = (category: keyof SummaryData | 'otros', title: string) => {
    if (!summaryData) return;
    let districts: CategoryDistrictInfo[] = category === 'otros' ? [
        ...summaryData.parroquia.districts, ...summaryData.localVotacion.districts,
        ...summaryData.juzgado.districts, ...summaryData.propiedadIntendencia.districts,
        ...summaryData.otrosNoEspecificado.districts,
    ] : summaryData[category].districts;
    setSelectedCategory(title);
    setDistrictsForCategory(districts.sort((a,b) => a.displayName.localeCompare(b.displayName)));
    setIsDialogOpen(true);
  };
  
  const handleDistrictClick = (deptName: string, distName: string) => {
    if (deptName && distName) {
      router.push(`/ficha?dept=${encodeURIComponent(deptName)}&dist=${encodeURIComponent(distName)}`);
    }
  };

  if (isUserLoading || isLoadingDatos || isLoadingReports || !summaryData || !isClient) {
    return (
        <div className="flex min-h-screen w-full flex-col">
            <Header title="Resumen Detallado por Ubicación" />
            <main className="flex flex-1 flex-col p-4 gap-8 justify-center items-center">
                 <Loader2 className="h-12 w-12 animate-spin text-primary" />
                 <p className="text-muted-foreground">Cargando datos del resumen...</p>
            </main>
        </div>
    );
  }

  const otrosCount = summaryData.parroquia.count + summaryData.localVotacion.count + summaryData.juzgado.count + summaryData.propiedadIntendencia.count + summaryData.otrosNoEspecificado.count;

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header title="Resumen Detallado por Ubicación" />
      <main className="flex flex-1 flex-col p-4 gap-8">
        <Card className="w-full max-w-6xl mx-auto">
            <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                      <CardTitle>Resumen General</CardTitle>
                      <CardDescription>Visión global de los informes registrados en el sistema.</CardDescription>
                  </div>
                    {canGeneratePdf && (
                        <Button onClick={handleGeneratePdf} disabled={isGeneratingPdf} size="sm">
                            {isGeneratingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                            Generar Resumen PDF
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="p-6">
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <h3 className="text-sm font-medium">Total de Informes</h3>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="text-2xl font-bold cursor-pointer" onClick={() => handleCategoryClick('totalReports', 'Total de Informes')}>
                        {summaryData.totalReports.count}
                    </div>
                </Card>
                <Card className="p-6">
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <h3 className="text-sm font-medium">Habitaciones Seguras</h3>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="text-2xl font-bold cursor-pointer" onClick={() => handleCategoryClick('habitacionSegura', 'Habitaciones Seguras')}>
                        {summaryData.habitacionSegura.count}
                    </div>
                </Card>
                <Card className="p-6">
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <h3 className="text-sm font-medium">Comisarías</h3>
                        <Shield className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="text-2xl font-bold cursor-pointer" onClick={() => handleCategoryClick('comisaria', 'Comisarías')}>
                        {summaryData.comisaria.count}
                    </div>
                </Card>
                <Card className="p-6">
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <h3 className="text-sm font-medium">Otros Lugares</h3>
                        <Building className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="text-2xl font-bold cursor-pointer" onClick={() => handleCategoryClick('otros', 'Otros Lugares')}>
                        {otrosCount}
                    </div>
                </Card>
            </CardContent>
        </Card>

        <Card className="w-full max-w-6xl mx-auto">
          <CardHeader>
            <CardTitle>Informe Detallado por Distrito</CardTitle>
            <CardDescription>Explora los informes para cada departamento y distrito.</CardDescription>
          </CardHeader>
          <CardContent>
              <Accordion type="multiple" className="w-full">
                {structuredData.map((department) => (
                  <AccordionItem value={department.id} key={department.id}>
                    <AccordionTrigger className="text-lg font-semibold hover:no-underline">{department.name}</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 px-4">
                        {department.districts.map((district) => (
                          <div key={district.name} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
                            <span className="text-md font-medium cursor-pointer hover:underline" onClick={() => handleDistrictClick(department.name, district.name)}>
                                {district.name}
                            </span>
                            {district.report ? <ResguardoIcon lugar={district.report['lugar-resguardo']} /> : <p className="text-sm text-muted-foreground italic">No hay informe</p>}
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
          </CardContent>
        </Card>
      </main>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>{selectedCategory}</DialogTitle></DialogHeader>
              <ScrollArea className="h-72 w-full rounded-md border">
                  <div className="p-4 space-y-1">
                      {districtsForCategory.map((info, idx) => (
                          <Button key={idx} variant="ghost" className="w-full justify-start h-auto py-2" onClick={() => handleDistrictClick(info.departamento, info.distrito)}>
                            {info.displayName}
                          </Button>
                      ))}
                  </div>
              </ScrollArea>
          </DialogContent>
      </Dialog>
    </div>
  );
}
