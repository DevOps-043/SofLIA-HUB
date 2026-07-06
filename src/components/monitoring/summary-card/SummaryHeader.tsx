export function SummaryHeader({ hasSummary }: { hasSummary: boolean }) {
  return (
    <div className="flex items-center justify-between mb-8">
      <div>
        <h3 className="text-gray-900 dark:text-white text-lg font-semibold">Resumen Inteligente</h3>
        <p className="text-xs text-secondary mt-0.5">Analisis con Inteligencia Artificial</p>
      </div>
      {hasSummary && (
        <div className="flex items-center gap-2 px-3 py-1 bg-accent/10 border border-accent/20 rounded-full">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
          </span>
          <span className="text-xs font-medium text-accent">Optimizado con IA</span>
        </div>
      )}
    </div>
  );
}
