import { useEffect, useRef, type ReactNode } from 'react';

export interface BrowserToolsMenuItem {
  id: string;
  label: string;
  icon: ReactNode;
  active?: boolean;
  /** Combinación que ejecuta lo mismo, p. ej. «Ctrl+H». Sólo informativa. */
  shortcut?: string;
  onSelect: () => void;
}

/** Cada sección se separa con una línea, como en el menú de Chrome. */
export type BrowserToolsMenuSection = BrowserToolsMenuItem[];

export interface BrowserToolsMenuZoom {
  percent: number;
  zoomInShortcut: string;
  zoomOutShortcut: string;
  fullscreen: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleFullscreen: () => void;
}

/**
 * Menú general del navegador. Las acciones sobre una pestaña concreta viven en
 * su menú contextual y el audio en la propia pestaña; aquí queda lo que en
 * Chrome cuelga del menú principal.
 */
export function BrowserToolsMenu(props: {
  sections: BrowserToolsMenuSection[];
  /** Fila de zoom que se inserta tras la sección indicada. */
  zoom?: BrowserToolsMenuZoom & { afterSection: number };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { open, onOpenChange } = props;

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) onOpenChange(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('mousedown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open, onOpenChange]);

  const activeCount = props.sections.flat().filter((item) => item.active).length;

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        aria-label="Herramientas del navegador"
        title="Herramientas del navegador"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className={`group relative grid h-8.5 w-8.5 place-items-center rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${open || activeCount > 0 ? 'bg-accent/15 text-accent shadow-xs shadow-accent/20 font-semibold' : 'text-gray-600 hover:bg-white hover:text-accent hover:shadow-xs dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-accent'}`}
      >
        <svg className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Gestores del navegador"
          className="absolute right-0 top-[calc(100%+0.375rem)] z-80 max-h-[min(75vh,40rem)] w-72 overflow-y-auto rounded-2xl border border-gray-200/80 bg-white/98 p-1.5 shadow-xl shadow-black/10 backdrop-blur-xl dark:border-white/10 dark:bg-[#161b22]/98"
        >
          {props.sections.map((section, index) => (
            <div key={section[0]?.id ?? index}>
              {index > 0 && <MenuSeparator />}
              {section.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  title={item.shortcut ? `${item.label} · ${item.shortcut}` : undefined}
                  onClick={() => { onOpenChange(false); item.onSelect(); }}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-medium transition ${item.active ? 'bg-accent/9 text-accent' : 'text-primary hover:bg-gray-100 dark:text-white/85 dark:hover:bg-white/5'} ${MENU_ICON_CLASS}`}
                >
                  {item.icon}
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.shortcut && <kbd aria-hidden="true" className="shrink-0 font-sans text-[11px] font-normal text-secondary">{item.shortcut}</kbd>}
                </button>
              ))}
              {props.zoom && props.zoom.afterSection === index && <ZoomRow zoom={props.zoom} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const MENU_ICON_CLASS = '[&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-2 [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round]';

function MenuSeparator() {
  return <div role="separator" className="mx-2 my-1 h-px bg-gray-200/80 dark:bg-white/8" />;
}

/** Igual que en Chrome, ajustar el zoom no cierra el menú para poder repetir. */
function ZoomRow({ zoom }: { zoom: BrowserToolsMenuZoom }) {
  const buttonClass = `grid h-8 w-8 place-items-center rounded-lg text-primary transition hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:text-white/85 dark:hover:bg-white/6 ${MENU_ICON_CLASS}`;
  return (
    <>
      <MenuSeparator />
      <div role="group" aria-label="Zoom" className="flex items-center gap-1 px-2.5 py-1 text-[13px] font-medium text-primary dark:text-white/85">
        <span className="flex-1">Zoom</span>
        <button type="button" role="menuitem" aria-label={`Alejar (${zoom.zoomOutShortcut})`} title={`Alejar · ${zoom.zoomOutShortcut}`} onClick={zoom.onZoomOut} className={buttonClass}>
          <svg viewBox="0 0 24 24"><path d="M5 12h14" /></svg>
        </button>
        <output aria-live="polite" className="w-12 text-center tabular-nums">{zoom.percent}%</output>
        <button type="button" role="menuitem" aria-label={`Acercar (${zoom.zoomInShortcut})`} title={`Acercar · ${zoom.zoomInShortcut}`} onClick={zoom.onZoomIn} className={buttonClass}>
          <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
        </button>
        <span className="mx-1 h-5 w-px bg-gray-200/80 dark:bg-white/8" aria-hidden="true" />
        <button
          type="button"
          role="menuitemcheckbox"
          aria-checked={zoom.fullscreen}
          aria-label={zoom.fullscreen ? 'Salir de pantalla completa (F11)' : 'Pantalla completa (F11)'}
          title={zoom.fullscreen ? 'Salir de pantalla completa · F11' : 'Pantalla completa · F11'}
          onClick={zoom.onToggleFullscreen}
          className={`${buttonClass} ${zoom.fullscreen ? 'text-accent' : ''}`}
        >
          <svg viewBox="0 0 24 24"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" /></svg>
        </button>
      </div>
    </>
  );
}
