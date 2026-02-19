'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useEffect, useState } from 'react';
import { Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { useUser } from '@/firebase';
import { Sidebar, SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from '@/components/app-sidebar';
import { dashboardMenuItems } from '@/lib/menu-config';
import { Button } from './ui/button';

function AuthLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading, userError } = useUser();
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Safety timeout: if after 15s we are still loading, show an error hatch
    const timer = setTimeout(() => {
      if (isUserLoading) setTimedOut(true);
    }, 15000);
    return () => clearTimeout(timer);
  }, [isUserLoading]);

  const accessibleMenuItems = useMemo(() => {
    if (!user?.profile) return [];
    if (user.profile.role === 'admin') return dashboardMenuItems;
    const modules = user.profile.modules || [];
    return dashboardMenuItems.filter(item => modules.includes(item.href.substring(1)));
  }, [user]);

  useEffect(() => {
    if (!mounted || isUserLoading) return;

    if (!user && pathname !== '/login') {
      router.replace('/login');
    } else if (user && pathname === '/login') {
      router.replace('/');
    } else if (user && pathname === '/' && user.profile?.role && user.profile?.role !== 'admin' && accessibleMenuItems.length === 1) {
      const targetPath = accessibleMenuItems[0]?.href;
      if (targetPath) router.replace(targetPath);
    }
  }, [isUserLoading, user, pathname, router, accessibleMenuItems, mounted]);

  if (userError || timedOut) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center p-6 text-center space-y-6 bg-background">
        <div className="space-y-2">
          <div className="flex justify-center mb-4">
            <AlertTriangle className="h-12 w-12 text-yellow-500" />
          </div>
          <h2 className="text-2xl font-black uppercase text-primary tracking-tighter">Tiempo de espera agotado</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            El sistema está tardando demasiado en responder o hay un error de conexión.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={() => window.location.reload()} className="h-12 px-8 font-black uppercase">
            <RefreshCw className="mr-2 h-4 w-4" /> Reintentar
          </Button>
          <Button variant="outline" onClick={() => router.push('/login')} className="h-12 px-8 font-black uppercase">
            Ir al Login
          </Button>
        </div>
      </div>
    );
  }

  if (isUserLoading || !mounted) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
            Sincronizando Sistema
          </p>
        </div>
      </div>
    );
  }

  if (pathname === '/login') {
    return <div className="animate-in fade-in duration-300">{children}</div>;
  }

  return (
    <SidebarProvider defaultOpen={false}>
      <Sidebar collapsible="offcanvas">
        <AppSidebar />
      </Sidebar>
      <SidebarInset>
        <div key={pathname} className="flex flex-1 flex-col">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AuthLayout>{children}</AuthLayout>;
}
