
'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useUser } from '@/firebase';
import { Sidebar, SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from '@/components/app-sidebar';
import { dashboardMenuItems } from '@/lib/menu-config';

function AuthLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const accessibleMenuItems = useMemo(() => {
    if (!user?.profile) return [];
    return dashboardMenuItems.filter(item => {
      if (user.profile.role === 'admin') {
        return true;
      }
      const moduleName = item.href.substring(1);
      return user.profile.modules?.includes(moduleName);
    });
  }, [user]);

  useEffect(() => {
    if (isUserLoading || !mounted) return;

    if (!user && pathname !== '/login') {
      router.replace('/login');
    } else if (user && pathname === '/login') {
      router.replace('/');
    } else if (user && pathname === '/' && user.profile?.role && user.profile?.role !== 'admin' && accessibleMenuItems.length === 1) {
      const targetPath = accessibleMenuItems[0]?.href;
      if (targetPath) {
        router.replace(targetPath);
      }
    }
  }, [isUserLoading, user, pathname, router, accessibleMenuItems, mounted]);
  
  const isRedirecting = useMemo(() => {
    if (!mounted) return true;
    if (isUserLoading) return true;
    
    const isLoginPage = pathname === '/login';
    
    if (!user) {
      // Si no hay usuario y no estamos en login, estamos en proceso de redirección
      return !isLoginPage; 
    }
    
    if (isLoginPage) {
      // Si hay usuario pero seguimos en login, estamos redirigiendo al home
      return true;
    }
    
    // Auto-redirect para usuarios con un solo modulo en la raiz
    if (pathname === '/' && user.profile?.role && user.profile?.role !== 'admin' && accessibleMenuItems.length === 1) return true;
    
    return false;
  }, [isUserLoading, user, pathname, accessibleMenuItems, mounted]);

  if (isRedirecting) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div className="absolute inset-0 flex items-center justify-center">
               <div className="h-2 w-2 bg-primary rounded-full animate-ping" />
            </div>
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 animate-pulse">
            Iniciando Sistema
          </p>
        </div>
      </div>
    );
  }

  if (pathname === '/login') {
    return <div key="login-root" className="animate-in fade-in duration-300">{children}</div>;
  }

  return (
    <SidebarProvider defaultOpen={false}>
      <Sidebar collapsible="offcanvas">
        <AppSidebar />
      </Sidebar>
      <SidebarInset>
        <div key={pathname} className="flex flex-1 flex-col animate-in fade-in slide-in-from-bottom-1 duration-200">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AuthLayout>{children}</AuthLayout>;
}
