import Header from '@/components/header';
import DepartmentList from '@/components/department-list';

export default function Home() {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header />
      <main className="flex-1">
        <DepartmentList />
      </main>
    </div>
  );
}
