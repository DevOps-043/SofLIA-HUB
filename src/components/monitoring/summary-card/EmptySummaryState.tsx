type Props = {
  generating: boolean;
  hasLogs: boolean;
  onGenerate: () => void;
};

export function EmptySummaryState({ generating, hasLogs, onGenerate }: Props) {
  return (
    <div className="py-12 flex flex-col items-center justify-center text-center space-y-6">
      <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center border border-white/10 shadow-inner group-hover/summary:scale-110 group-hover/summary:rotate-3 transition-all duration-500">
        <svg className="w-10 h-10 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      <div className="max-w-xs transition-all">
        <p className="text-sm text-gray-400 font-medium leading-relaxed">
          {hasLogs
            ? 'Hemos analizado tu actividad. Haz clic para generar un resumen detallado con SofLIA AI.'
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
      className="group/gen relative overflow-hidden px-8 py-3.5 rounded-2xl bg-white text-black text-xs font-black uppercase tracking-widest transition-all hover:scale-[1.05] active:scale-[0.98] shadow-2xl hover:shadow-white/10"
    >
      <div className="absolute inset-0 bg-violet-600 translate-y-full group-hover/gen:translate-y-0 transition-transform duration-500" />
      <span className="relative z-10 flex items-center gap-2 group-hover/gen:text-white transition-colors duration-300">
        {generating ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Analizando...
          </>
        ) : 'Generar Analisis IA'}
      </span>
    </button>
  );
}
