import { UpdatePanel } from '../../UpdatePanel';

export function SystemUpdateSection() {
  return (
    <div className="settings-section flex flex-col h-full overflow-hidden">
      {/* Header Banner Editorial SOFIA */}
      <div className="settings-section-header shrink-0 px-8 pt-7 pb-4 bg-gradient-to-b from-black/[0.02] dark:from-white/[0.02] to-transparent border-b border-border/60">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold tracking-[0.18em] uppercase text-accent">Control Técnico</span>

            </div>
            <h2 className="text-2xl font-sans font-semibold text-gray-900 dark:text-white mt-1 tracking-tight">
              Sistema y actualizaciones
            </h2>
            <p className="text-xs text-secondary mt-0.5 max-w-xl">
              Verifica el estado del cliente nativo, consulta notas de versión y actualiza a las compilaciones más recientes.
            </p>
          </div>
        </div>
      </div>

      {/* ÁREA DE CONTENIDO */}
      <div className="settings-section-body flex-1 overflow-y-auto px-8 py-6 space-y-6 no-scrollbar">
        <div className="animate-in fade-in duration-200">
          <UpdatePanel />
        </div>
      </div>
    </div>
  );
}
