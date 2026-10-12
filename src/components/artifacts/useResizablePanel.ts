import './panel-resize.css';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

/** Preferencia visual local, acotada al espacio real; no contiene datos del chat. */
export function useResizablePanel({ storageKey, initialWidth, minWidth = 320, maxWidth = 1100, reserve = 0, enabled = true }: {
  storageKey: string; initialWidth: number; minWidth?: number; maxWidth?: number; reserve?: number; enabled?: boolean;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const [preferred, setPreferred] = useState(() => {
    try { const value = Number(localStorage.getItem(storageKey)); if (Number.isFinite(value) && value >= minWidth) return Math.min(value, maxWidth); } catch { /* Preferencia opcional. */ }
    return initialWidth;
  });
  const [available, setAvailable] = useState(maxWidth);
  const [resizing, setResizing] = useState(false);
  const drag = useRef<{ x: number; width: number; current: number } | null>(null);
  const persist = useCallback((value: number) => {
    try { localStorage.setItem(storageKey, String(value)); } catch { /* El ajuste funciona también sin almacenamiento. */ }
  }, [storageKey]);
  const clearDrag = useCallback(() => {
    if (drag.current) persist(drag.current.current);
    drag.current = null;
  }, [persist]);
  // La retirada del nodo cancela el arrastre aunque no llegue lostpointercapture.
  const bindPanel = useCallback((node: HTMLElement | null) => {
    panelRef.current = node;
    if (!node || !enabled) { clearDrag(); setResizing(false); }
  }, [clearDrag, enabled]);
  useEffect(() => {
    if (!enabled) return;
    const parent = panelRef.current?.parentElement;
    const measure = () => setAvailable(Math.max(240, Math.min(maxWidth, window.innerWidth - 32, (parent?.clientWidth || window.innerWidth) - reserve - 24)));
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (parent) observer?.observe(parent);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect(); window.removeEventListener('resize', measure);
      clearDrag();
    };
  }, [maxWidth, reserve, enabled, clearDrag]);
  const minimum = Math.min(minWidth, available);
  const width = Math.min(available, Math.max(minimum, preferred));
  const apply = (value: number) => {
    const next = Math.round(Math.max(minimum, Math.min(available, value)));
    setPreferred(next);
    return next;
  };
  const finish = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const finalWidth = drag.current.current;
    drag.current = null; setResizing(false); persist(finalWidth);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return { bindPanel, width, resizing, minimum, maximum: available, handlers: {
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { x: event.clientX, width, current: width }; setResizing(true);
    },
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => { if (drag.current) drag.current.current = apply(drag.current.width + drag.current.x - event.clientX); },
    onPointerUp: finish, onPointerCancel: finish,
    onLostPointerCapture: () => { if (drag.current) persist(drag.current.current); drag.current = null; setResizing(false); },
    onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      persist(apply(event.key === 'Home' ? minimum : event.key === 'End' ? available : width + (event.key === 'ArrowLeft' ? 32 : -32)));
    },
  } };
}
