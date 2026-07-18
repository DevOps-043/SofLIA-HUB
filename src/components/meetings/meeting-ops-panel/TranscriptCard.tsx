import { useState } from 'react';
import type { RunDetail } from './run-detail-types';

interface TranscriptCardProps {
  detail: RunDetail;
}

/**
 * Transcripcion completa de la reunion (fuente de evidencia de la minuta).
 * Colapsada por defecto: el texto puede ser muy largo.
 */
export function TranscriptCard({ detail }: TranscriptCardProps) {
  const [abierto, setAbierto] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const artifacts = (detail.source_artifacts || []).filter((artifact) => (artifact.normalized_text || '').trim());
  if (artifacts.length === 0) return null;

  const textoCompleto = artifacts.map((artifact) => artifact.normalized_text || '').join('\n\n---\n\n');

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(textoCompleto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso de clipboard: no bloquear.
    }
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-[#1a1c20]/50 border border-gray-200 dark:border-white/10 p-5 shadow-sm dark:shadow-lg">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setAbierto(!abierto)}
          className="flex items-center gap-2 text-left"
        >
          <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Transcripcion ({artifacts.length === 1 ? '1 fuente' : `${artifacts.length} fuentes`})
          </span>
          <svg
            className={`h-3.5 w-3.5 text-gray-400 transition-transform ${abierto ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {abierto && (
          <button
            onClick={() => void copiar()}
            className="rounded-lg border border-gray-200 px-2.5 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-100 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/[0.05]"
          >
            {copiado ? 'Copiado ✓' : 'Copiar todo'}
          </button>
        )}
      </div>

      {!abierto && (
        <p className="mt-2 text-[13px] leading-relaxed text-gray-500 dark:text-gray-400 line-clamp-2">
          {textoCompleto.slice(0, 220)}{textoCompleto.length > 220 ? '…' : ''}
        </p>
      )}

      {abierto && (
        <div className="mt-3 space-y-3">
          {artifacts.map((artifact) => (
            <div key={artifact.id}>
              {artifacts.length > 1 && (
                <div className="mb-1 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                  {artifact.source_system} · {artifact.source_type}
                  {artifact.created_at ? ` · ${artifact.created_at.slice(0, 16).replace('T', ' ')}` : ''}
                </div>
              )}
              <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-xl bg-gray-50 p-3 text-[13px] leading-relaxed text-gray-700 dark:bg-black/20 dark:text-gray-300">
                {artifact.normalized_text}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
