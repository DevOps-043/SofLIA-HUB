import { useEffect, useRef } from 'react';

interface OrbTranscriptPanelProps {
  errorMessage: string | null;
  glow: { soft: string; text: string };
  isListening: boolean;
  statusLabel: string;
  text: string;
}

export function OrbTranscriptPanel({
  errorMessage,
  glow,
  isListening,
  statusLabel,
  text,
}: OrbTranscriptPanelProps) {
  const transcriptViewport = useRef<HTMLDivElement>(null);
  const visibleText = text || (isListening ? 'Te escucho…' : '');

  // En dictados largos conserva a la vista las palabras más recientes. El
  // usuario aún puede desplazarse con rueda o trackpad, pero sin una barra que
  // compita visualmente con la orbe.
  useEffect(() => {
    const viewport = transcriptViewport.current;
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [visibleText]);

  if (!statusLabel && !visibleText && !errorMessage) return null;

  return (
    <div className="relative z-10 shrink-0 px-4 pb-3 pt-1 text-center">
      {statusLabel && (
        <p
          aria-label="Estado de la orbe"
          className="inline-flex rounded-full border border-white/10 bg-slate-950/60 px-2.5 py-1 text-[10px] font-semibold uppercase leading-none tracking-[0.28em] shadow-[0_6px_20px_rgba(0,0,0,0.2)] backdrop-blur-lg transition-colors duration-500"
          style={{ color: glow.text, textShadow: `0 0 14px ${glow.soft}` }}
        >
          {statusLabel}
        </p>
      )}

      {visibleText && (
        <div
          aria-label="Texto dictado"
          className="orb-no-drag mx-auto mt-2 overflow-hidden rounded-2xl border border-white/[0.14] bg-slate-950/70 text-left shadow-[0_12px_36px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl"
        >
          <div
            ref={transcriptViewport}
            role="log"
            aria-live="polite"
            aria-relevant="text"
            className="no-scrollbar max-h-24 overflow-y-auto px-4 py-3"
          >
            <p className={`whitespace-pre-wrap break-words text-[13px] font-medium leading-5 ${text ? 'text-white/90' : 'text-white/55'}`}>
              {visibleText}
            </p>
          </div>
        </div>
      )}

      {errorMessage && (
        <p className="mt-2 rounded-xl border border-red-300/20 bg-red-950/65 px-3 py-2 text-xs leading-4 text-red-100 backdrop-blur-xl">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
