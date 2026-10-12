import { useMemo } from 'react';
import { useCopyToClipboard } from '../../../hooks/useCopyToClipboard';
import { highlightChatCode } from './code-highlight';

// Lenguajes que son prosa (prompts, texto plano): se envuelven en vez de hacer scroll horizontal.
const PROSE_LANGUAGES = new Set(['', 'text', 'txt', 'plaintext', 'plain', 'prompt', 'markdown', 'md']);

export function CodeBlock({ language, code }: { language: string; code: string }) {
  const { status, copy } = useCopyToClipboard();
  const copied = status === 'copied';
  const isProse = PROSE_LANGUAGES.has(language.trim().toLowerCase());
  const highlightedCode = useMemo(() => highlightChatCode(language, code), [language, code]);

  return (
    <div className="chat-code-block my-4 w-full max-w-full min-w-0 rounded-lg overflow-hidden bg-[#1E1E1E] border border-white/10 shadow-sm relative group">
      <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5">
        <span className="text-xs text-gray-400 uppercase font-mono">{language || 'text'}</span>
        <button
          type="button"
          onClick={() => void copy(code)}
          disabled={status === 'copying'}
          aria-label={copied ? 'Código copiado' : 'Copiar código'}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-2 py-1 rounded disabled:opacity-60"
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              <span className="text-accent font-medium">Copiado</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              <span>{status === 'copying' ? 'Copiando…' : 'Copiar'}</span>
            </>
          )}
        </button>
      </div>
      {status === 'error' && (
        <p role="alert" className="px-4 pt-2 text-xs text-red-300">No se pudo copiar. Inténtalo de nuevo.</p>
      )}
      <pre className="m-0 p-4 overflow-x-auto custom-scrollbar">
        <code
          className={`hljs text-[13px] leading-relaxed font-mono block min-w-full ${isProse ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'} font-ligatures-none`}
          {...(highlightedCode === null ? { children: code } : { dangerouslySetInnerHTML: { __html: highlightedCode } })}
        />
      </pre>
    </div>
  );
}
