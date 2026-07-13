import { MarkdownRenderer } from '../chat/MarkdownRenderer';
import type { OrbSource } from './useOrbConversation';

// Panel reservado para respuestas verificadas con fuentes. La conversación
// cotidiana permanece en modo voz y conserva a la orbe como único foco visual.
export function OrbInfoPanel({ responseText, sources }: { responseText: string; sources: OrbSource[] }) {
  const sourceLabel = sources.length === 1 ? '1 fuente' : `${sources.length} fuentes`;

  return (
    <section className="relative mx-3 mb-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[24px] border border-amber-200/15 bg-[linear-gradient(155deg,rgba(8,13,22,0.97),rgba(3,6,12,0.94))] shadow-[0_24px_80px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-2xl">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/70 to-transparent"
      />

      <header className="relative flex items-center gap-3 border-b border-white/[0.08] px-4 py-3.5">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-amber-300/20 bg-amber-300/[0.08] shadow-[0_0_24px_rgba(251,191,36,0.1)]">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px] text-amber-200" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M12 3.5 13.4 8l4.4 1.5-4.4 1.4L12 15.5l-1.4-4.6-4.4-1.4L10.6 8 12 3.5Z" />
            <path d="m18.5 14 .7 2.2 2.1.8-2.1.7-.7 2.3-.8-2.3-2.1-.7 2.1-.8.8-2.2Z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-200/90">
            Información verificada
          </p>
          <p className="mt-0.5 truncate text-[11px] text-slate-400">
            SofLIA encontró referencias para esta respuesta
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-cyan-300/15 bg-cyan-300/[0.07] px-2.5 py-1 text-[10px] font-medium text-cyan-100/90">
          {sourceLabel}
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 text-[13px] leading-6 text-slate-100 [scrollbar-color:rgba(251,191,36,0.38)_rgba(255,255,255,0.04)] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-amber-300/35 [&::-webkit-scrollbar-track]:bg-white/[0.03] [&_a]:!text-cyan-300 [&_blockquote]:!text-slate-300 [&_code]:!text-amber-100 [&_em]:!text-slate-300 [&_h1]:!text-white [&_h2]:!text-white [&_h3]:!text-amber-100 [&_h4]:!text-slate-100 [&_h5]:!text-slate-200 [&_h6]:!text-slate-300 [&_p]:!text-slate-100 [&_strong]:!text-white [&_td]:!text-slate-200 [&_thead]:!text-white">
        <MarkdownRenderer text={responseText} />
      </div>

      <footer className="border-t border-white/[0.08] bg-black/20 px-4 py-3">
        <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          Fuentes consultadas
        </p>
        <div className="max-h-28 space-y-1.5 overflow-y-auto pr-1 [scrollbar-width:thin]">
          {sources.slice(0, 6).map((source, index) => (
            <a
              key={`${source.uri}-${index}`}
              href={source.uri}
              target="_blank"
              rel="noreferrer"
              className="group flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.035] px-3 py-2 transition-colors hover:border-cyan-300/20 hover:bg-cyan-300/[0.06]"
              title={source.uri}
            >
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-white/[0.06] text-[9px] font-semibold text-slate-300 group-hover:text-cyan-200">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-[11px] text-slate-300 group-hover:text-slate-100">
                {source.title || source.uri}
              </span>
              <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5 shrink-0 text-slate-600 group-hover:text-cyan-300" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M7 13 13 7M8.5 7H13v4.5" />
                <path d="M13 11.5V15H5V7h3.5" />
              </svg>
            </a>
          ))}
        </div>
      </footer>
    </section>
  );
}
