
'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { type Department } from '@/lib/data';
import { type ReportData } from '@/app/settings/page';
import { Label } from '@/components/ui/label';

export default function FichaPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [reports, setReports] = useState<ReportData[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [filteredReports, setFilteredReports] = useState<ReportData[]>([]);

  useEffect(() => {
    // Cargar datos de departamentos y distritos
    const storedDepts = localStorage.getItem('imported_departments');
    if (storedDepts) {
      try {
        setDepartments(JSON.parse(storedDepts));
      } catch (e) {
        console.error('Error parsing departments:', e);
      }
    }

    // Cargar datos de reportes
    const storedReports = localStorage.getItem('imported_reports');
    if (storedReports) {
      try {
        const allReports = JSON.parse(storedReports);
        setReports(allReports);
        setFilteredReports(allReports); // Mostrar todos al inicio
      } catch (e) {
        console.error('Error parsing reports:', e);
      }
    }
  }, []);

  const handleDeptChange = (deptName: string) => {
    setSelectedDept(deptName);
    setSelectedDistrict(''); // Reset district filter
    if (deptName) {
      const filtered = reports.filter(
        (r) => r.departamento?.toLowerCase() === deptName.toLowerCase()
      );
      setFilteredReports(filtered);
    } else {
      setFilteredReports(reports); // Si no hay departamento, mostrar todos
    }
  };

  const handleDistrictChange = (distName: string) => {
    setSelectedDistrict(distName);
    if (distName) {
      const filtered = reports.filter(
        (r) =>
          r.departamento?.toLowerCase() === selectedDept.toLowerCase() &&
          r.distrito?.toLowerCase() === distName.toLowerCase()
      );
      setFilteredReports(filtered);
    } else {
       handleDeptChange(selectedDept); // Si se deselecciona distrito, volver a filtrar por departamento
    }
  };
  
  const currentDistricts = departments.find(d => d.name === selectedDept)?.districts || [];

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header title="Vista de Ficha" />
      <main className="flex flex-1 flex-col p-4 gap-8">
        <Card className="w-full max-w-6xl mx-auto">
          <CardHeader>
            <CardTitle>Filtros de Visualización</CardTitle>
            <CardDescription>
              Selecciona un departamento y distrito para ver la información detallada.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 space-y-2">
              <Label>Departamento</Label>
              <Select onValueChange={handleDeptChange} value={selectedDept}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar Departamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos los Departamentos</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.name}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-2">
              <Label>Distrito</Label>
              <Select
                onValueChange={handleDistrictChange}
                value={selectedDistrict}
                disabled={!selectedDept}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar Distrito" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos los Distritos</SelectItem>
                  {currentDistricts.map((dist) => (
                    <SelectItem key={dist.id} value={dist.name}>
                      {dist.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-6xl mx-auto">
            {filteredReports.length > 0 ? (
                filteredReports.map((report, index) => (
                    <Card key={index}>
                        <CardHeader>
                            <CardTitle>{report.distrito}, {report.departamento}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                           {Object.entries(report).map(([key, value]) => {
                             if (key === 'departamento' || key === 'distrito') return null;
                             return (
                               <div key={key}>
                                 <p className="font-semibold capitalize text-muted-foreground">{key.replace(/-/g, ' ')}:</p>
                                 <p>{value}</p>
                               </div>
                             );
                           })}
                        </CardContent>
                    </Card>
                ))
            ) : (
                <div className="col-span-full text-center py-12">
                    <p className="text-muted-foreground">No hay reportes que coincidan con los filtros seleccionados.</p>
                </div>
            )}
        </div>
      </main>
    </div>
  );
}
