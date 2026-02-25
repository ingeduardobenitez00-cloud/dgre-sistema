
export default function Loading() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 relative">
           <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
           <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
          Cargando recursos...
        </p>
      </div>
    </div>
  );
}
