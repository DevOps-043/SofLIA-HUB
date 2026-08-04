import { useId, useState } from 'react';
import { MarkdownRenderer } from '../chat/MarkdownRenderer';
import type { OrbSource } from './useOrbConversation';

// Panel reservado para respuestas verificadas con fuentes. La conversación
// cotidiana permanece en modo voz y conserva a la orbe como único foco visual.
export function OrbInfoPanel({ responseText, sources }: { responseText: string; sources: OrbSource[] }) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const sourcesId = useId();
  const sourceLabel = sources.length === 1 ? '1 fuente consultada' : `${sources.length} fuentes consultadas`;

  return (
    <section
      aria-label="Respuesta de SofLIA"
      className="orb-no-drag relative mx-3 mb-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[22px] border border-border bg-card/95 text-primary shadow-[0_24px_70px_rgba(10,37,64,0.16),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-2xl dark:shadow-[0_24px_70px_rgba(0,0,0,0.44),inset_0_1px_0_rgba(255,255,255,0.06)]"
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 text-[13px] leading-6 text-primary [scrollbar-color:color-mix(in_srgb,var(--color-accent-val)_28%,transparent)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-accent/25 [&::-webkit-scrollbar-track]:bg-transparent [&_a]:!text-accent [&_blockquote]:!text-secondary [&_em]:!text-secondary [&_h1]:!text-primary [&_h2]:!text-primary [&_h3]:!text-primary [&_h4]:!text-primary [&_h5]:!text-primary [&_h6]:!text-primary [&_p]:!text-primary [&_strong]:!text-primary [&_td]:!text-secondary [&_thead]:!text-primary">
        <MarkdownRenderer text={responseText} />
      </div>

      {sources.length > 0 && (
        <div className="shrink-0 border-t border-border bg-surface-2/80">
          <button
            type="button"
            aria-label={`${sourcesOpen ? 'Ocultar' : 'Mostrar'} ${sourceLabel}`}
            aria-controls={sourcesId}
            aria-expanded={sourcesOpen}
            onClick={() => setSourcesOpen((open) => !open)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent/[0.08] text-accent">
              <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M6.5 5.5h8v9h-8z" />
                <path d="M4 3v9h2.5M9 8h3.5M9 11h3.5" />
              </svg>
            </span>
            <span className="min-w-0 flex-1 text-[11px] font-semibold text-primary">
              {sourceLabel}
            </span>
            <span className="text-[10px] font-medium text-secondary">
              {sourcesOpen ? 'Ocultar' : 'Mostrar'}
            </span>
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className={`h-4 w-4 shrink-0 text-secondary transition-transform duration-200 ${sourcesOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
            >
              <path d="m6 8 4 4 4-4" />
            </svg>
          </button>

          {sourcesOpen && (
            <div
              id={sourcesId}
              className="max-h-40 space-y-1.5 overflow-y-auto border-t border-border px-3 py-3 [scrollbar-color:color-mix(in_srgb,var(--color-accent-val)_24%,transparent)_transparent] [scrollbar-width:thin]"
            >
              {sources.map((source, index) => (
                <a
                  key={`${source.uri}-${index}`}
                  aria-label={source.title || source.uri}
                  href={source.uri}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5 transition-colors hover:border-accent/30 hover:bg-background"
                  title={source.uri}
                >
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-surface-2 text-[9px] font-semibold text-secondary group-hover:text-accent">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[11px] text-secondary group-hover:text-primary">
                    {source.title || source.uri}
                  </span>
                  <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5 shrink-0 text-secondary/70 group-hover:text-accent" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M7 13 13 7M8.5 7H13v4.5" />
                    <path d="M13 11.5V15H5V7h3.5" />
                  </svg>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
