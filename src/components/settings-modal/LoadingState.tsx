export function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
      <div className="relative">
        <div className="w-12 h-12 border-2 border-white/5 rounded-full" />
        <div className="absolute inset-0 w-12 h-12 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
      <p className="text-[10px] font-black text-accent uppercase tracking-[0.3em] animate-pulse">Analizando Perfil...</p>
    </div>
  );
}
