import { useState, useRef, useEffect, useCallback } from 'react';
import { integratedBrowserService, type IntegratedBrowserTabState, type IntegratedBrowserViewMode } from '../../services/integrated-browser-service';

export function OverlayTabFrame(props: {
  secondaryTab: IntegratedBrowserTabState;
  viewportRef: React.RefObject<HTMLDivElement | null>;
  onSetViewMode: (mode: IntegratedBrowserViewMode, secondaryTabId?: string) => void;
  onCloseTab: (tabId: string) => void;
}) {
  const [pos, setPos] = useState({ x: 40, y: 40, w: 480, h: 360 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [snapTarget, setSnapTarget] = useState<'left' | 'right' | 'top' | 'bottom' | null>(null);

  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({ mouseX: 0, mouseY: 0, startX: 0, startY: 0 });
  const resizeStartRef = useRef<{ mouseX: number; mouseY: number; startW: number; startH: number }>({ mouseX: 0, mouseY: 0, startW: 0, startH: 0 });

  const { secondaryTab, viewportRef, onSetViewMode, onCloseTab } = props;

  // Sincroniza los limites con el proceso principal
  useEffect(() => {
    void integratedBrowserService.setOverlayBounds({
      x: pos.x,
      y: pos.y,
      width: pos.w,
      height: pos.h,
    });
  }, [pos.x, pos.y, pos.w, pos.h]);

  // Actualiza posicion inicial al montar segun el alto/ancho del viewport (Formato Vertical Alto)
  useEffect(() => {
    if (!viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    const w = Math.min(Math.max(360, Math.round(rect.width * 0.40)), rect.width - 24);
    const h = Math.max(200, rect.height - 24);
    const x = Math.max(12, rect.width - w - 12);
    const y = 12;
    setPos({ x, y, w, h });
  }, [viewportRef]);

  // Arrastre (Drag)
  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, startX: pos.x, startY: pos.y };
  };

  // Redimensión (Resize)
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, startW: pos.w, startH: pos.h };
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();

    if (isDragging) {
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;

      let newX = dragStartRef.current.startX + dx;
      let newY = dragStartRef.current.startY + dy;

      // Limites de viewport
      newX = Math.max(0, Math.min(newX, rect.width - pos.w));
      newY = Math.max(0, Math.min(newY, rect.height - pos.h));

      setPos((prev) => ({ ...prev, x: newX, y: newY }));

      // Deteccion de bordes para Windows Snap
      const snapThreshold = 35;
      if (newX <= snapThreshold) {
        setSnapTarget('left');
      } else if (newX + pos.w >= rect.width - snapThreshold) {
        setSnapTarget('right');
      } else if (newY <= snapThreshold) {
        setSnapTarget('top');
      } else if (newY + pos.h >= rect.height - snapThreshold) {
        setSnapTarget('bottom');
      } else {
        setSnapTarget(null);
      }
    } else if (isResizing) {
      const dw = e.clientX - resizeStartRef.current.mouseX;
      const dh = e.clientY - resizeStartRef.current.mouseY;

      const newW = Math.max(260, Math.min(resizeStartRef.current.startW + dw, rect.width - pos.x));
      const newH = Math.max(180, Math.min(resizeStartRef.current.startH + dh, rect.height - pos.y));

      setPos((prev) => ({ ...prev, w: newW, h: newH }));
    }
  }, [isDragging, isResizing, pos.w, pos.h, pos.x, pos.y, viewportRef]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      if (snapTarget === 'left' || snapTarget === 'right' || snapTarget === 'top' || snapTarget === 'bottom') {
        // Al pegar la ventana a un borde, conmutar a pantalla dividida (Windows Snap)
        onSetViewMode('split', secondaryTab.id);
      }
      setSnapTarget(null);
    }
    if (isResizing) {
      setIsResizing(false);
    }
  }, [isDragging, isResizing, snapTarget, onSetViewMode, secondaryTab.id]);

  useEffect(() => {
    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  return (
    <>
      {/* Vista previa de acoplamiento de Windows (Snap Target Preview) */}
      {snapTarget && (
        <div
          className={`pointer-events-none absolute z-[70] animate-pulse rounded-2xl border-2 border-accent bg-accent/20 backdrop-blur-xs transition-all duration-150 ${
            snapTarget === 'left'
              ? 'inset-y-2 left-2 w-[calc(50%-0.5rem)]'
              : snapTarget === 'right'
              ? 'inset-y-2 right-2 w-[calc(50%-0.5rem)]'
              : snapTarget === 'top'
              ? 'inset-x-2 top-2 h-[calc(50%-0.5rem)]'
              : 'inset-x-2 bottom-2 h-[calc(50%-0.5rem)]'
          }`}
        >
          <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-accent">
            Soltar para acoplar pestaña (Windows Snap)
          </div>
        </div>
      )}

      {/* Marco Flotante para la pestaña superpuesta */}
      <div
        style={{
          left: `${pos.x}px`,
          top: `${pos.y}px`,
          width: `${pos.w}px`,
          height: `${pos.h}px`,
        }}
        className={`absolute z-[60] flex flex-col rounded-2xl border border-gray-300/80 bg-white/95 shadow-2xl backdrop-blur-xl transition-shadow dark:border-white/15 dark:bg-[#161b22]/95 ${
          isDragging ? 'ring-2 ring-accent shadow-accent/30 cursor-grabbing' : ''
        }`}
      >
        {/* Barra superior de la ventana superpuesta (Drag Header) */}
        <div
          onMouseDown={handleDragStart}
          className="flex h-8 cursor-grab select-none items-center justify-between border-b border-gray-200/80 bg-gray-100/80 px-2.5 rounded-t-2xl dark:border-white/[0.08] dark:bg-[#0d1117]/80"
        >
          <div className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
            <svg className="h-3.5 w-3.5 shrink-0 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="13" height="16" rx="2" />
              <rect x="10" y="8" width="11" height="12" rx="2" />
            </svg>
            <span className="truncate">{secondaryTab.title || secondaryTab.url}</span>
          </div>

          <div className="flex items-center gap-1">
            {/* Convertir a vista dividida */}
            <button
              type="button"
              title="Acoplar ventana al lado"
              onClick={() => onSetViewMode('split', secondaryTab.id)}
              className="grid h-5 w-5 place-items-center rounded text-gray-500 hover:bg-black/10 dark:text-gray-400 dark:hover:bg-white/15"
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="8" height="16" rx="1.5" />
                <rect x="13" y="4" width="8" height="16" rx="1.5" />
              </svg>
            </button>
            {/* Cerrar pestaña superpuesta */}
            <button
              type="button"
              title="Cerrar ventana superpuesta"
              onClick={() => onCloseTab(secondaryTab.id)}
              className="grid h-5 w-5 place-items-center rounded-full text-gray-500 hover:bg-danger/20 hover:text-danger dark:text-gray-400"
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Cuerpo de la vista superpuesta (espacio transparente donde Electron renderiza la vista) */}
        <div className="relative min-h-0 flex-1" />

        {/* Tirador de redimensión (Resize Handle en la esquina inferior derecha) */}
        <div
          onMouseDown={handleResizeStart}
          title="Arrastrar para cambiar tamaño"
          className="absolute bottom-0 right-0 grid h-4 w-4 cursor-se-resize place-items-center text-gray-400 hover:text-accent"
        >
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15l-6 6M21 9l-12 12" />
          </svg>
        </div>
      </div>
    </>
  );
}
