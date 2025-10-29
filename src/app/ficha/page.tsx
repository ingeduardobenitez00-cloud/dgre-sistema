
'use client';

import { useState } from 'react';
import Header from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { type Department, type District, type ReportData } from '@/lib/data';
import { Label } from '@/components/ui/label';
import { useFirebase, useMemoFirebase } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function FichaPage() {
  const { firestore } = useFirebase();

  const departmentsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'departamentos') : null, [firestore]);
  const { data: departments } = useCollection<Department>(departmentsQuery);

  const [districts, setDistricts] = useState<District[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');

  const reportsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    // The type assertion is needed because query returns a generic Query type
    let q: any = collection(firestore, 'reports');
    if (selectedDept) {
      q = query(q, where('departamento', '==', selectedDept));
    }
    if (selectedDistrict) {
      q = query(q, where('distrito', '==', selectedDistrict));
    }
    return q;
  }, [firestore, selectedDept, selectedDistrict]);

  const { data: filteredReports } = useCollection<ReportData>(reportsQuery);

  const handleDeptChange = async (deptId: string) => {
    setSelectedDistrict('');

    if (deptId === 'all-depts') {
        setSelectedDeptId('all-depts');
        setSelectedDept('');
        setDistricts([]);
        return;
    }

    setSelectedDeptId(deptId);

    if (deptId && firestore) {
      const selectedDepartment = departments?.find(d => d.id === deptId);
      setSelectedDept(selectedDepartment?.name || '');

      const districtsQuery = collection(firestore, 'departamentos', deptId, 'distritos');
      const districtsSnapshot = await getDocs(districtsQuery);
      const fetchedDistricts = districtsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as District));
      setDistricts(fetchedDistricts);
    } else {
      setSelectedDept('');
      setDistricts([]);
    }
  };

  const handleDistrictChange = (distName: string) => {
    if (distName === 'all-districts') {
      setSelectedDistrict('');
    } else {
      setSelectedDistrict(distName);
    }
  };
  
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
              <Select onValueChange={handleDeptChange} value={selectedDeptId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar Departamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-depts">Todos los Departamentos</SelectItem>
                  {departments?.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
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
                value={selectedDistrict || 'all-districts'}
                disabled={!selectedDept}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar Distrito" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-districts">Todos los Distritos</SelectItem>
                  {districts.map((dist) => (
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
            {filteredReports && filteredReports.length > 0 ? (
                filteredReports.map((report, index) => (
                    <Card key={index}>
                        <CardHeader>
                            <CardTitle>{report.distrito}, {report.departamento}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                           {Object.entries(report).map(([key, value]) => {
                             if (key === 'departamento' || key === 'distrito' || key === 'id') return null;
                             return (
                               <div key={key}>
                                 <p className="font-semibold capitalize text-muted-foreground">{key.replace(/-/g, ' ')}:</p>
                                 <p>{String(value)}</p>
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
