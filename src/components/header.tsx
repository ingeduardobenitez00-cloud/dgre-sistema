import Link from 'next/link';
import { BookMarked, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <div className="mr-4 flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <BookMarked className="h-6 w-6 text-primary" />
            <span className="hidden font-bold sm:inline-block">
              Informe Edilicio
            </span>
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link
              href="/"
              className="transition-colors hover:text-foreground/80 text-foreground/60"
            >
              Departamentos
            </Link>
            <Link
              href="/import"
              className="transition-colors hover:text-foreground/80 text-foreground/60"
            >
              Importar
            </Link>
            <Link
              href="/settings"
              className="transition-colors hover:text-foreground/80 text-foreground/60"
            >
              Configuración
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
