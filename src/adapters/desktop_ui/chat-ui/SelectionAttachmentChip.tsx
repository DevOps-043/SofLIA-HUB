import type { BrowserSelectionAttachment } from './types';

/** Recorte del texto visible en el chip; el turno sigue llevando la seleccion completa. */
const PREVIEW_CHARS = 160;

/**
 * Muestra sobre la barra de escritura el fragmento que el usuario selecciono en
 * el navegador. Es contexto adjunto, no un turno: queda a la vista mientras el
 * usuario redacta su peticion y se puede descartar sin enviar nada.
 */
export function SelectionAttachmentChip(props: {
  selection: BrowserSelectionAttachment | null;
  onDismiss: () => void;
}) {
  if (!props.selection) return null;

  const texto = props.selection.text.trim();
  const preview = texto.length > PREVIEW_CHARS ? `${texto.slice(0, PREVIEW_CHARS).trimEnd()}…` : texto;

  return (
    <div className="mb-1.5 flex min-w-0 items-start gap-2 rounded-2xl border border-border/70 bg-surface-2 px-3 py-2">
      <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2M9 20h6M12 4v16" />
      </svg>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-medium text-secondary">
          {props.selection.title || 'Selección del navegador'}
        </p>
        <p className="mt-0.5 line-clamp-2 break-words text-[12px] italic leading-[17px] text-secondary">
          {'“' + preview + '”'}
        </p>
      </div>
      <button
        type="button"
        onClick={props.onDismiss}
        aria-label="Quitar la selección adjunta"
        title="Quitar la selección adjunta"
        className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-secondary transition hover:bg-gray-100 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:hover:bg-white/[0.08] dark:hover:text-white"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
