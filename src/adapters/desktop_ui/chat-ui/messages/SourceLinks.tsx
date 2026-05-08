import type { ChatMessage } from '../../../../services/chat-service';

type Source = NonNullable<ChatMessage['sources']>[number];

function getSourceHost(uri: string): string {
  try {
    return new URL(uri).hostname;
  } catch {
    return '';
  }
}

export function SourceLinks({ sources }: { sources?: Source[] }) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {sources.map((source, index) => {
        const host = getSourceHost(source.uri);
        return (
          <a key={index} href={source.uri} target="_blank" rel="noopener noreferrer" className="group inline-flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 rounded-full border border-gray-200 dark:border-white/5 hover:bg-accent/10 hover:border-accent/20 hover:text-accent transition-all no-underline" title={source.snippet || source.title}>
            {host && (
              <div className="w-3.5 h-3.5 flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity">
                <img src={`https://www.google.com/s2/favicons?domain=${host}&sz=32`} className="w-full h-full object-contain" alt="" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
              </div>
            )}
            <span className="truncate max-w-[140px]">{source.title || 'Source'}</span>
          </a>
        );
      })}
    </div>
  );
}
