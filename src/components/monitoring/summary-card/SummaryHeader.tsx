export function SummaryHeader({ hasSummary }: { hasSummary: boolean }) {
  return (
    <div className="flex items-center justify-between mb-8">
      <div>
        <h3 className="text-white text-lg font-black tracking-tight">Resumen Inteligente</h3>
        <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">Analisis con Inteligencia Artificial</p>
      </div>
      {hasSummary && (
        <div className="flex items-center gap-2 px-3 py-1 bg-violet-500/10 border border-violet-500/20 rounded-full">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
          </span>
          <span className="text-[10px] font-black text-violet-400 uppercase tracking-widest">Optimizado con IA</span>
        </div>
      )}
    </div>
  );
}
