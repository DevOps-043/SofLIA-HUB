import type { ChatMessage } from '../../../../services/chat-service';
import { browserFragmentSources } from '../../../../shared/browser-tab-context';

type Source = NonNullable<ChatMessage['sources']>[number];

export function SourceLinks({ sources, responseText }: { sources?: Source[]; responseText?: string }) {
  if (!sources?.length) return null;
  const fragments = browserFragmentSources(sources);
  const web = sources.filter((source) => source && !source.kind && safeWebSourceUrl(source.uri)).slice(0, 50);
  const citations = [...new Set(Array.from((responseText ?? '').matchAll(/\[(P\d+:F\d+)\]/g), (match) => match[1]))];
  const missing = citations.filter((id) => !fragments.some((source) => source.citationId === id));
  return (
    <div className="mt-3 space-y-2 text-xs">
      {fragments.length > 0 && <section aria-label="Fragmentos de pestañas proporcionados al modelo">
        <p className="mb-2 text-secondary">Fragmentos proporcionados · Consulta la evidencia de cada cita. No equivalen a una lectura completa.</p>
        {responseText !== undefined && !citations.length && <p role="status">El modelo no señaló citas de fragmentos. Revisa la evidencia antes de confiar en la conclusión.</p>}
        {missing.length > 0 && <p role="alert">Referencias sin fragmento asociado: {missing.slice(0, 24).join(', ')}. No se consideran verificadas.</p>}
        {fragments.map((source) => (
          <details key={source.citationId} className="my-1 rounded-lg border border-border p-2">
            <summary className="cursor-pointer">[{source.citationId}] {source.title || 'Pestaña sin título'}</summary>
            <blockquote className="my-2 whitespace-pre-wrap break-words">{source.snippet}</blockquote>
            <p className="text-secondary">Capturado: {new Date(source.capturedAt).toLocaleString('es')}</p>
            <a href={source.uri} target="_blank" rel="noopener noreferrer" className="break-all text-accent">Abrir sitio · {source.uri}</a>
          </details>
        ))}
      </section>}
      {web.length > 0 && <div className="flex flex-wrap gap-2">{web.map((source, index) => (
        <a key={index} href={safeWebSourceUrl(source.uri)!} target="_blank" rel="noopener noreferrer" className="rounded-full border border-border px-3 py-1 text-accent" title={source.snippet || source.title}>
          {source.title || 'Fuente web'}
        </a>
      ))}</div>}
    </div>
  );
}

/** Conservar consultas de fuentes web existentes; nunca ejecutar otro esquema ni credenciales. */
function safeWebSourceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}
