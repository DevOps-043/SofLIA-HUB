import { getToolDisplayName } from './tool-display-names';

type ActiveToolCall = {
  name: string;
  args?: {
    path?: string;
    command?: string;
  };
};

export function ChatLoadingIndicator({ activeToolCall }: { activeToolCall?: ActiveToolCall | null }) {
  return (
    <div className="flex gap-3.5 select-none animate-in fade-in duration-300">
      {/* Avatar de LIA */}
      <div className="w-8 h-8 flex items-center justify-center flex-shrink-0 rounded-full overflow-hidden border border-border/60 shadow-sm ring-2 ring-background">
        <img src="./assets/lia-avatar.png" alt="SOFLIA" className="w-full h-full object-cover" />
      </div>

      <div className="flex flex-col gap-2 pt-0.5">
        {activeToolCall ? (
          /* Globo de Acción de Herramienta Elegante y Profesional */
          <div className="flex items-center gap-2.5 px-3.5 py-1.5 bg-accent/[0.06] dark:bg-accent/[0.12] border border-accent/25 dark:border-accent/30 rounded-2xl rounded-tl-sm shadow-sm backdrop-blur-md animate-in zoom-in-95 duration-200">
            {/* Spinner con halo de brillo */}
            <div className="relative flex items-center justify-center w-3.5 h-3.5 shrink-0">
              <span className="absolute w-full h-full rounded-full bg-accent/20 animate-ping opacity-75" />
              <div className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin shrink-0" />
            </div>
            
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[12px] font-semibold text-accent leading-none tracking-tight">
                {getToolDisplayName(activeToolCall.name)}
              </span>
              
              {/* Opciones adicionales: ruta simplificada o comando en chip stilizado */}
              {(activeToolCall.args?.path || activeToolCall.args?.command) && (
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-accent/35 text-[10px] select-none font-mono">/</span>
                  <span 
                    className="text-[11px] font-mono text-foreground/80 dark:text-foreground/90 bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded-md truncate max-w-[220px] leading-tight font-medium" 
                    title={activeToolCall.args?.path || activeToolCall.args?.command}
                  >
                    {activeToolCall.args?.path 
                      ? activeToolCall.args.path.split(/[/\\]/).pop() 
                      : activeToolCall.args?.command}
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Globo de Escritura Clásico Animado */
          <div className="flex items-center gap-1.5 px-4 py-2.5 bg-black/[0.02] dark:bg-white/[0.02] border border-border/40 rounded-xl rounded-tl-sm w-fit">
            <div className="w-1.5 h-1.5 bg-accent/80 rounded-full animate-bounce [animation-duration:1s]" />
            <div className="w-1.5 h-1.5 bg-accent/80 rounded-full animate-bounce [animation-duration:1s] [animation-delay:0.2s]" />
            <div className="w-1.5 h-1.5 bg-accent/80 rounded-full animate-bounce [animation-duration:1s] [animation-delay:0.4s]" />
          </div>
        )}
      </div>
    </div>
  );
}

