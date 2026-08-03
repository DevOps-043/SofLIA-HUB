import { TOOL_DISPLAY_NAMES } from './tool-display-names';

type ActiveToolCall = {
  name: string;
  args?: {
    path?: string;
    command?: string;
  };
};

export function ChatLoadingIndicator({ activeToolCall }: { activeToolCall?: ActiveToolCall | null }) {
  return (
    <div className="flex gap-4 select-none animate-in fade-in duration-300">
      {/* Avatar de LIA */}
      <div className="w-8 h-8 flex items-center justify-center flex-shrink-0 rounded-full overflow-hidden border border-border shadow-sm">
        <img src="./assets/lia-avatar.png" alt="PULSE" className="w-full h-full object-cover" />
      </div>

      <div className="flex flex-col gap-2 pt-1.5">
        {activeToolCall ? (
          /* Globo de Acción de Herramienta Ultra-Minimalista */
          <div className="flex items-center gap-2.5 px-3 py-1.5 bg-accent/[0.04] dark:bg-accent/[0.08] border border-accent/20 rounded-xl rounded-tl-sm shadow-sm animate-in zoom-in-95 duration-200">
            {/* Spinner fino */}
            <div className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin shrink-0" />
            
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span className="text-[11px] font-semibold text-accent leading-none">
                {TOOL_DISPLAY_NAMES[activeToolCall.name] || activeToolCall.name}
              </span>
              
              {/* Opciones adicionales: ruta simplificada o comando */}
              {(activeToolCall.args?.path || activeToolCall.args?.command) && (
                <>
                  <span className="text-accent/30 text-[10px] select-none font-mono">/</span>
                  <span 
                    className="text-[10px] text-secondary font-mono truncate max-w-[200px] leading-none" 
                    title={activeToolCall.args?.path || activeToolCall.args?.command}
                  >
                    {activeToolCall.args?.path 
                      ? activeToolCall.args.path.split(/[/\\]/).pop() 
                      : activeToolCall.args?.command}
                  </span>
                </>
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
