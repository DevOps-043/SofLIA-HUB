type Props = {
  generating: boolean;
  hasLogs: boolean;
  onGenerate: () => void;
};

export function EmptySummaryState({ generating, hasLogs, onGenerate }: Props) {
  return (
    <div className="py-12 flex flex-col items-center justify-center text-center space-y-6">
      <div className="w-20 h-20 bg-surface-2 rounded-3xl flex items-center justify-center border border-border">
        <svg className="w-10 h-10 text-secondary/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      <div className="max-w-xs">
        <p className="text-sm text-secondary leading-relaxed">
          {hasLogs
            ? 'Hemos analizado tu actividad. Haz clic para generar un resumen detallado con Pulse AI.'
            : 'Aun no hay actividad suficiente para generar un analisis. Inicia un monitoreo para comenzar.'}
        </p>
      </div>
      {hasLogs && <GenerateButton generating={generating} onGenerate={onGenerate} />}
    </div>
  );
}

function GenerateButton({ generating, onGenerate }: { generating: boolean; onGenerate: () => void }) {
  return (
    <button
      onClick={onGenerate}
      disabled={generating}
      className="px-6 py-3 rounded-xl bg-accent text-on-accent text-sm font-medium transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-50 flex items-center gap-2"
    >
      {generating ? (
        <>
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Analizando...
        </>
      ) : 'Generar Analisis IA'}
    </button>
  );
}
