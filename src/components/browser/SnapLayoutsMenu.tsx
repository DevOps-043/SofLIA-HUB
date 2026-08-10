import { useEffect, useRef } from 'react';
import {
  integratedBrowserService,
  type IntegratedBrowserViewMode,
} from '../../services/integrated-browser-service';

export function SnapLayoutsMenu(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectLayout: (mode: IntegratedBrowserViewMode, ratio?: number, direction?: 'horizontal' | 'vertical') => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!props.open) return undefined;
    const closeOnOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) props.onOpenChange(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') props.onOpenChange(false);
    };
    document.addEventListener('mousedown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [props]);

  if (!props.open) return null;

  const handleSetPosition = (pos: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'center' | 'vertical-right' | 'vertical-left' | 'vertical-center') => {
    props.onSelectLayout('overlay');
    void integratedBrowserService.setOverlayPosition(pos as 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'center');
    props.onOpenChange(false);
  };

  return (
    <div
      ref={containerRef}
      className="absolute right-0 top-[calc(100%+0.5rem)] z-[100] w-84 rounded-2xl border border-gray-200/90 bg-white/98 p-4 shadow-2xl backdrop-blur-2xl dark:border-white/[0.12] dark:bg-[#0d1117]/98 text-gray-900 dark:text-white animate-fade-in select-none"
      role="menu"
      aria-label="Diseños de acoplamiento de Windows (Snap Layouts)"
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="text-[11px] font-bold tracking-wider text-gray-500 dark:text-gray-400 uppercase">Organizar Ventanas (Snap Layouts)</span>
        <button
          type="button"
          onClick={() => props.onOpenChange(false)}
          className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Grid de 6 esquemas principales de acoplamiento */}
      <div className="grid grid-cols-3 gap-2.5">
        {/* Layout 1: 50 / 50 Dividido horizontal */}
        <SnapCard
          title="División 50/50 Lado a Lado"
          onClick={() => {
            props.onSelectLayout('split', 0.5, 'horizontal');
            props.onOpenChange(false);
          }}
        >
          <div className="grid h-full w-full grid-cols-2 gap-1 rounded border border-gray-300 dark:border-gray-600/50 p-1">
            <div className="rounded bg-accent/40 transition-colors group-hover:bg-accent" />
            <div className="rounded bg-gray-300 dark:bg-gray-700/60 transition-colors group-hover:bg-accent/70" />
          </div>
        </SnapCard>

        {/* Layout 2: 67 / 33 Izquierda ancha */}
        <SnapCard
          title="Principal 67% / Secundaria 33%"
          onClick={() => {
            props.onSelectLayout('split', 0.67, 'horizontal');
            props.onOpenChange(false);
          }}
        >
          <div className="grid h-full w-full grid-cols-[2fr_1fr] gap-1 rounded border border-gray-300 dark:border-gray-600/50 p-1">
            <div className="rounded bg-accent/40 transition-colors group-hover:bg-accent" />
            <div className="rounded bg-gray-300 dark:bg-gray-700/60 transition-colors group-hover:bg-accent/70" />
          </div>
        </SnapCard>

        {/* Layout 3: 3 Columnas iguales */}
        <SnapCard
          title="3 Columnas"
          onClick={() => {
            props.onSelectLayout('split', 0.33, 'horizontal');
            props.onOpenChange(false);
          }}
        >
          <div className="grid h-full w-full grid-cols-3 gap-1 rounded border border-gray-300 dark:border-gray-600/50 p-1">
            <div className="rounded bg-accent/40 transition-colors group-hover:bg-accent" />
            <div className="rounded bg-gray-300 dark:bg-gray-700/60 transition-colors group-hover:bg-accent/70" />
            <div className="rounded bg-gray-300 dark:bg-gray-700/60 transition-colors group-hover:bg-accent/70" />
          </div>
        </SnapCard>

        {/* Layout 4: Arriba / Abajo 50/50 */}
        <SnapCard
          title="División Vertical Arriba / Abajo"
          onClick={() => {
            props.onSelectLayout('split', 0.5, 'vertical');
            props.onOpenChange(false);
          }}
        >
          <div className="grid h-full w-full grid-rows-2 gap-1 rounded border border-gray-300 dark:border-gray-600/50 p-1">
            <div className="rounded bg-accent/40 transition-colors group-hover:bg-accent" />
            <div className="rounded bg-gray-300 dark:bg-gray-700/60 transition-colors group-hover:bg-accent/70" />
          </div>
        </SnapCard>

        {/* Layout 5: Columna Vertical Derecha */}
        <SnapCard
          title="Columna Flotante Vertical (Derecha)"
          onClick={() => handleSetPosition('vertical-right')}
        >
          <div className="grid h-full w-full grid-cols-[2fr_1fr] gap-1 rounded border border-gray-300 dark:border-gray-600/50 p-1">
            <div className="rounded bg-gray-200 dark:bg-gray-800" />
            <div className="rounded bg-accent/70 transition-colors group-hover:bg-accent" />
          </div>
        </SnapCard>

        {/* Layout 6: Columna Vertical Izquierda */}
        <SnapCard
          title="Columna Flotante Vertical (Izquierda)"
          onClick={() => handleSetPosition('vertical-left')}
        >
          <div className="grid h-full w-full grid-cols-[1fr_2fr] gap-1 rounded border border-gray-300 dark:border-gray-600/50 p-1">
            <div className="rounded bg-accent/70 transition-colors group-hover:bg-accent" />
            <div className="rounded bg-gray-200 dark:bg-gray-800" />
          </div>
        </SnapCard>
      </div>

      {/* Sección de Formato y Posicionamiento de Pestaña Superpuesta */}
      <div className="mt-3.5 border-t border-gray-200 dark:border-gray-700/60 pt-3">
        <span className="mb-2 block px-1 text-[11px] font-bold tracking-wider text-gray-500 dark:text-gray-400 uppercase">Posición y Formato de Pestaña</span>
        <div className="grid grid-cols-3 gap-1.5 text-[11px]">
          <button
            type="button"
            title="Columna vertical a la derecha"
            onClick={() => handleSetPosition('vertical-right')}
            className="flex items-center justify-center gap-1 rounded-lg border border-gray-200 bg-gray-100/90 px-2 py-1.5 font-medium text-gray-700 transition-all hover:border-accent hover:bg-accent/15 hover:text-accent dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-200 dark:hover:border-accent dark:hover:bg-accent/25 dark:hover:text-white"
          >
            <span>▮</span> Vertical Der.
          </button>
          <button
            type="button"
            title="Columna vertical a la izquierda"
            onClick={() => handleSetPosition('vertical-left')}
            className="flex items-center justify-center gap-1 rounded-lg border border-gray-200 bg-gray-100/90 px-2 py-1.5 font-medium text-gray-700 transition-all hover:border-accent hover:bg-accent/15 hover:text-accent dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-200 dark:hover:border-accent dark:hover:bg-accent/25 dark:hover:text-white"
          >
            <span>▮</span> Vertical Izq.
          </button>
          <button
            type="button"
            title="Columna vertical centrada"
            onClick={() => handleSetPosition('vertical-center')}
            className="flex items-center justify-center gap-1 rounded-lg border border-gray-200 bg-gray-100/90 px-2 py-1.5 font-medium text-gray-700 transition-all hover:border-accent hover:bg-accent/15 hover:text-accent dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-200 dark:hover:border-accent dark:hover:bg-accent/25 dark:hover:text-white"
          >
            <span>✢</span> Centro
          </button>

          <button
            type="button"
            title="Cuadro horizontal arriba derecha"
            onClick={() => handleSetPosition('top-right')}
            className="flex items-center justify-center gap-1 rounded-lg border border-gray-200 bg-gray-100/90 px-2 py-1.5 font-medium text-gray-700 transition-all hover:border-accent hover:bg-accent/15 hover:text-accent dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-200 dark:hover:border-accent dark:hover:bg-accent/25 dark:hover:text-white"
          >
            <span>↗</span> Arriba Der.
          </button>
          <button
            type="button"
            title="Cuadro horizontal abajo derecha"
            onClick={() => handleSetPosition('bottom-right')}
            className="flex items-center justify-center gap-1 rounded-lg border border-gray-200 bg-gray-100/90 px-2 py-1.5 font-medium text-gray-700 transition-all hover:border-accent hover:bg-accent/15 hover:text-accent dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-200 dark:hover:border-accent dark:hover:bg-accent/25 dark:hover:text-white"
          >
            <span>↘</span> Abajo Der.
          </button>
          <button
            type="button"
            title="Pantalla completa una pestaña"
            onClick={() => {
              props.onSelectLayout('single');
              props.onOpenChange(false);
            }}
            className="flex items-center justify-center gap-1 rounded-lg border border-gray-200 bg-gray-100/90 px-2 py-1.5 font-medium text-gray-700 transition-all hover:border-accent hover:bg-accent/15 hover:text-accent dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-200 dark:hover:border-accent dark:hover:bg-accent/25 dark:hover:text-white"
          >
            <span>☐</span> Pantalla Única
          </button>
        </div>
      </div>
    </div>
  );
}

function SnapCard({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="group relative flex h-14 w-full items-center justify-center rounded-xl border border-gray-200 bg-gray-50/80 p-1.5 transition-all duration-200 hover:scale-105 hover:border-accent hover:bg-white hover:shadow-md hover:shadow-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:border-gray-700/60 dark:bg-gray-800/60 dark:hover:bg-gray-800 dark:hover:shadow-accent/20"
    >
      {children}
    </button>
  );
}
