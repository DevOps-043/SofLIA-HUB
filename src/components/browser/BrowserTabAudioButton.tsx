import type { IntegratedBrowserTabState } from '../../services/integrated-browser-service';

/**
 * Icono de sonido de la pestaña, como en Chrome: aparece mientras reproduce
 * audio o está silenciada y alterna el silencio sin activar la pestaña.
 */
export function BrowserTabAudioButton(props: {
  tab: IntegratedBrowserTabState;
  onToggleMuted: (tabId: string, muted: boolean) => void;
}) {
  const { tab } = props;
  if (!tab.audible && !tab.muted) return null;
  const title = tab.title || 'pestaña';
  const label = tab.muted ? `Activar sonido de ${title}` : `Silenciar ${title}`;
  return (
    <button
      type="button"
      data-tab-action="audio"
      aria-label={label}
      aria-pressed={Boolean(tab.muted)}
      title={tab.muted ? 'Activar sonido de la pestaña' : 'Silenciar pestaña'}
      onClick={(event) => {
        event.stopPropagation();
        props.onToggleMuted(tab.id, !tab.muted);
      }}
      className={`ml-0.5 grid h-4.5 w-4.5 shrink-0 place-items-center rounded transition hover:bg-black/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent dark:hover:bg-white/15 ${tab.muted ? 'text-secondary' : 'text-accent'}`}
    >
      <svg className="pointer-events-none h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M11 5L6 9H2v6h4l5 4V5z" />
        {tab.muted ? <path d="M23 9l-6 6M17 9l6 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />}
      </svg>
    </button>
  );
}
