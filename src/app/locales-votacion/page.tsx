'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { type LocalVotacion, type Dato } from '@/lib/data';
import Header from '@/components/header';
import { Loader2, Vote, Search } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

export default function LocalesVotacionPage() {
  const { firestore } = useFirebase();

  // Data for filters
  const datosQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'datos') : null), [firestore]);
  const { data: datosData, isLoading: isLoadingDatos } = useCollection<Dato>(datosQuery);

  const [departments, setDepartments] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);

  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [shouldFetch, setShouldFetch] = useState(false);

  // Data for locales
  const localesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    if (!shouldFetch && !selectedDepartment && !selectedDistrict) return collection(firestore, 'locales-votacion');

    if (selectedDepartment && selectedDistrict) {
      return query(
        collection(firestore, 'locales-votacion'),
        where('departamento', '==', selectedDepartment),
        where('distrito', '==', selectedDistrict)
      );
    }
    if (selectedDepartment) {
      return query(collection(firestore, 'locales-votacion'), where('departamento', '==', selectedDepartment));
    }
    return collection(firestore, 'locales-votacion');
  }, [firestore, shouldFetch, selectedDepartment, selectedDistrict]);

  const { data: localesData, isLoading: isLoadingLocales } = useCollection<LocalVotacion>(localesQuery);
  
  // Group data by department
  const localesByDepartment = useMemo(() => {
    if (!localesData) return {};
    return localesData.reduce((acc, local) => {
      const { departamento } = local;
      if (!acc[departamento]) {
        acc[departamento] = [];
      }
      acc[departamento].push(local);
      return acc;
    }, {} as Record<string, LocalVotacion[]>);
  }, [localesData]);

  // Populate filters
  useEffect(() => {
    if (datosData) {
      const uniqueDepts = [...new Set(datosData.map(d => d.departamento))].sort();
      setDepartments(uniqueDepts);
    }
  }, [datosData]);

  useEffect(() => {
    if (selectedDepartment && datosData) {
      const uniqueDistricts = [...new Set(datosData.filter(d => d.departamento === selectedDepartment).map(d => d.distrito))].sort();
      setDistricts(uniqueDistricts);
    } else {
      setDistricts([]);
    }
  }, [selectedDepartment, datosData]);

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
    setShouldFetch(true);
  };

  const isLoading = isLoadingDatos || (shouldFetch && isLoadingLocales);

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header title="Locales de Votación" />
      <main className="flex-1 p-4 md:p-6 lg:p-8 gap-8">
        <Card className="w-full max-w-6xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Vote className="h-6 w-6" />
              Listado de Locales de Votación
            </CardTitle>
            <CardDescription>
              Consulta los locales de votación importados. Puedes filtrar por departamento y distrito.
            </CardDescription>
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
              <Button onClick={handleSearch} disabled={!selectedDepartment || isLoading} className="w-full md:w-auto">
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
        
        {!isLoading && localesData && (
          <Card className="w-full max-w-7xl mx-auto">
            <CardContent className="pt-6">
              {Object.keys(localesByDepartment).length > 0 ? (
                <Accordion type="single" collapsible className="w-full" defaultValue={Object.keys(localesByDepartment)[0]}>
                  {Object.keys(localesByDepartment).sort().map((department) => (
                    <AccordionItem value={department} key={department}>
                      <AccordionTrigger className="text-lg font-semibold hover:no-underline data-[state=open]:text-primary">
                        {department}
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="overflow-auto border rounded-md">
                           <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Código</TableHead>
                                  <TableHead>Distrito</TableHead>
                                  <TableHead>Zona</TableHead>
                                  <TableHead>Local</TableHead>
                                  <TableHead>Dirección</TableHead>
                                  <TableHead>GPS</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {localesByDepartment[department].map((local) => (
                                  <TableRow key={local.id}>
                                    <TableCell>{local.codigo_local}</TableCell>
                                    <TableCell>{local.distrito}</TableCell>
                                    <TableCell>{local.zona}</TableCell>
                                    <TableCell>{local.local}</TableCell>
                                    <TableCell>{local.direccion}</TableCell>
                                    <TableCell>{local.gps}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No se encontraron locales de votación para la selección actual.</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
