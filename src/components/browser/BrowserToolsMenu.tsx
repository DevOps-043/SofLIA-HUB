import { useEffect, useRef, type ReactNode } from 'react';

export interface BrowserToolsMenuItem {
  id: string;
  label: string;
  icon: ReactNode;
  active?: boolean;
  onSelect: () => void;
}

/**
 * Agrupa los gestores del navegador en un solo control. Ocupaban cuatro botones
 * con etiqueta en la barra, y ese espacio es el que necesita la direccion para
 * comportarse como en cualquier navegador: ocupar todo el ancho libre.
 */
export function BrowserToolsMenu(props: {
  items: BrowserToolsMenuItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

  const activeCount = props.items.filter((item) => item.active).length;

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        aria-label="Herramientas del navegador"
        title="Herramientas del navegador"
        aria-haspopup="menu"
        aria-expanded={props.open}
        onClick={() => props.onOpenChange(!props.open)}
        className={`group relative grid h-8.5 w-8.5 place-items-center rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${props.open || activeCount > 0 ? 'bg-accent/15 text-accent shadow-xs shadow-accent/20 font-semibold' : 'text-gray-600 hover:bg-white hover:text-accent hover:shadow-xs dark:text-white/70 dark:hover:bg-white/[0.1] dark:hover:text-accent'}`}
      >
        <svg className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
        </svg>
      </button>
      {props.open && (
        <div
          role="menu"
          aria-label="Gestores del navegador"
          className="absolute right-0 top-[calc(100%+0.375rem)] z-[80] w-56 rounded-2xl border border-gray-200/80 bg-white/98 p-1.5 shadow-xl shadow-black/10 backdrop-blur-xl dark:border-white/[0.1] dark:bg-[#161b22]/98"
        >
          {props.items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              onClick={() => { props.onOpenChange(false); item.onSelect(); }}
              className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-medium transition ${item.active ? 'bg-accent/[0.09] text-accent' : 'text-primary hover:bg-gray-100 dark:text-white/85 dark:hover:bg-white/[0.05]'} [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-2 [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round]`}
            >
              {item.icon}
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
