import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent, type RefObject } from 'react';
import { createPortal } from 'react-dom';

type ChatContextMenuProps = {
  id: string;
  anchorRef: RefObject<HTMLButtonElement | null>;
  canRename: boolean;
  canMove: boolean;
  canDelete: boolean;
  isPinned: boolean;
  onTogglePin: () => void;
  onRename: () => void;
  onMove: () => void;
  onDelete: (event: MouseEvent) => void;
  onClose: () => void;
};

export function ChatContextMenu({
  id,
  anchorRef,
  canRename,
  canMove,
  canDelete,
  isPinned,
  onTogglePin,
  onRename,
  onMove,
  onDelete,
  onClose,
}: ChatContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<CSSProperties>({ visibility: 'hidden' });

  useLayoutEffect(() => {
    const updatePosition = () => {
      const anchor = anchorRef.current;
      const menu = menuRef.current;
      if (!anchor || !menu) return;
      const margin = 8;
      const gap = 6;
      const rect = anchor.getBoundingClientRect();
      const width = menu.offsetWidth;
      const height = menu.offsetHeight;
      const below = window.innerHeight - rect.bottom - gap - margin;
      const above = rect.top - gap - margin;
      const preferredTop = height > below && above > below
        ? rect.top - height - gap
        : rect.bottom + gap;
      setPosition({
        top: Math.max(margin, Math.min(preferredTop, window.innerHeight - height - margin)),
        left: Math.max(margin, Math.min(rect.right - width, window.innerWidth - width - margin)),
      });
    };
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    // Redimensionar la barra lateral también desplaza el botón de opciones.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updatePosition);
    const sidebar = anchorRef.current?.closest('aside');
    if (sidebar) observer?.observe(sidebar);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
      observer?.disconnect();
    };
  }, [anchorRef, canRename, canMove, canDelete]);

  useEffect(() => {
    menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const closeOutside = (event: globalThis.PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('pointerdown', closeOutside, true);
    return () => document.removeEventListener('pointerdown', closeOutside, true);
  }, [anchorRef, onClose]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (event.key === 'Escape' || event.key === 'Tab') {
      if (event.key === 'Escape') event.preventDefault();
      onClose();
      anchorRef.current?.focus({ preventScroll: true });
      return;
    }
    const actions = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? []);
    const current = actions.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? actions.length - 1
      : event.key === 'ArrowDown' ? (current + 1) % actions.length
        : event.key === 'ArrowUp' ? (current - 1 + actions.length) % actions.length : -1;
    if (next < 0) return;
    event.preventDefault();
    actions[next]?.focus({ preventScroll: true });
  };

  // El portal evita el recorte de overflow y los ancestros con backdrop-filter.
  return createPortal(
    <div
      ref={menuRef}
      id={id}
      role="menu"
      aria-label="Opciones de la conversación"
      style={{ ...position, position: 'fixed', maxWidth: 'calc(100vw - 16px)', maxHeight: 'calc(100dvh - 16px)' }}
      className="animate-context-menu-in pointer-events-auto z-[90] w-[136px] isolate overflow-y-auto rounded-[14px] border border-gray-200 bg-[#ffffff] bg-clip-padding p-1 shadow-[0_14px_32px_rgba(10,37,64,0.18)] ring-1 ring-black/[0.04] dark:border-white/[0.10] dark:bg-[#0b1118] dark:shadow-[0_18px_36px_rgba(0,0,0,0.52)] dark:ring-white/[0.04]"
      onKeyDown={handleKeyDown}
      onPointerDown={stopMenuPropagation}
      onMouseDown={stopMenuPropagation}
      onClick={stopMenuPropagation}
    >
      <button
        type="button"
        role="menuitem"
        tabIndex={-1}
        onPointerDown={stopMenuPropagation}
        onClick={(event) => { event.stopPropagation(); onTogglePin(); onClose(); }}
        className="group/item flex h-8 w-full items-center gap-2 rounded-[10px] px-2 text-left text-[12px] font-medium text-[#0A2540] transition-[background-color,color,transform] duration-150 ease-out hover:translate-x-0.5 hover:bg-[#0A2540]/10 hover:text-[#071a2d] dark:text-white/80 dark:hover:bg-white/[0.07] dark:hover:text-accent"
      >
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-[#0A2540]/10 text-secondary transition-colors group-hover/item:text-[#0A2540] dark:bg-white/[0.06] dark:text-white/50 dark:group-hover/item:text-accent">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="17" x2="12" y2="22" />
            <path d="M5 17h14v-1.76a2 2 0 0 0-.44-1.24l-2.33-2.92A2 2 0 0 1 15.8 9.84V5a2 2 0 0 0-2-2h-3.6a2 2 0 0 0-2 2v4.84a2 2 0 0 1-.43 1.24l-2.33 2.92A2 2 0 0 0 5 15.24z" />
          </svg>
        </div>
        <span>{isPinned ? 'Desanclar' : 'Anclar'}</span>
      </button>

      {canRename && (
        <button
          type="button"
          role="menuitem"
          tabIndex={-1}
          onPointerDown={stopMenuPropagation}
          onClick={(event) => { event.stopPropagation(); onRename(); onClose(); }}
          className="group/item flex h-8 w-full items-center gap-2 rounded-[10px] px-2 text-left text-[12px] font-medium text-[#0A2540] transition-[background-color,color,transform] duration-150 ease-out hover:translate-x-0.5 hover:bg-[#0A2540]/10 hover:text-[#071a2d] dark:text-white/80 dark:hover:bg-white/[0.07] dark:hover:text-accent"
        >
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-[#0A2540]/10 text-secondary transition-colors group-hover/item:text-[#0A2540] dark:bg-white/[0.06] dark:text-white/50 dark:group-hover/item:text-accent">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <span>Renombrar</span>
        </button>
      )}

      {canMove && (
        <button
          type="button"
          role="menuitem"
          tabIndex={-1}
          onPointerDown={stopMenuPropagation}
          onClick={(event) => { event.stopPropagation(); onMove(); onClose(); }}
          className="group/item flex h-8 w-full items-center gap-2 rounded-[10px] px-2 text-left text-[12px] font-medium text-[#0A2540] transition-[background-color,color,transform] duration-150 ease-out hover:translate-x-0.5 hover:bg-[#0A2540]/10 hover:text-[#071a2d] dark:text-white/80 dark:hover:bg-white/[0.07] dark:hover:text-accent"
        >
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-[#0A2540]/10 text-secondary transition-colors group-hover/item:text-[#0A2540] dark:bg-white/[0.06] dark:text-white/50 dark:group-hover/item:text-accent">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </div>
          <span>Mover</span>
        </button>
      )}

      {canDelete && <div className="mx-2 my-1 h-px bg-gray-200 dark:bg-white/[0.08]" />}

      {canDelete && (
        <button
          type="button"
          role="menuitem"
          tabIndex={-1}
          onPointerDown={stopMenuPropagation}
          onClick={(event) => { event.stopPropagation(); onDelete(event); onClose(); }}
          className="group/item flex h-8 w-full items-center gap-2 rounded-[10px] px-2 text-left text-[12px] font-semibold text-danger transition-[background-color,transform] duration-150 ease-out hover:bg-danger/10 hover:translate-x-0.5"
        >
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-danger/10 text-danger/75 transition-colors group-hover/item:text-danger">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <span className="font-medium">Eliminar</span>
        </button>
      )}
    </div>,
    document.body,
  );
}

function stopMenuPropagation(event: MouseEvent<HTMLElement> | PointerEvent<HTMLElement>): void {
  event.stopPropagation();
}
