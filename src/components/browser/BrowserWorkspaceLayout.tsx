import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { IntegratedBrowserPanel } from './IntegratedBrowserPanel';

const STORAGE_KEY = 'sofLia_integratedBrowserWidth';
const MIN_BROWSER_WIDTH = 420;
const MIN_CHAT_WIDTH = 320;

export function BrowserWorkspaceLayout(props: { chat: ReactNode; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [preferredWidth, setPreferredWidth] = useState(() => readStoredWidth());
  const previousSplitWidthRef = useRef(preferredWidth);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const update = () => setContainerWidth(Math.max(0, Math.round(containerRef.current?.getBoundingClientRect().width ?? 0)));
    const observer = new ResizeObserver(update);
    observer.observe(containerRef.current);
    update();
    return () => observer.disconnect();
  }, []);

  const browserWidth = resolveBrowserWidth(preferredWidth, containerWidth);
  const maximized = containerWidth > 0 && browserWidth >= containerWidth;
  const chatWidth = Math.max(0, containerWidth - browserWidth);

  const applyWidth = useCallback((next: number) => {
    const resolved = resolveBrowserWidth(next, containerWidth);
    if (resolved < containerWidth) previousSplitWidthRef.current = resolved;
    setPreferredWidth(resolved);
    localStorage.setItem(STORAGE_KEY, String(resolved));
  }, [containerWidth]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId) || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    applyWidth(rect.right - event.clientX);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    applyWidth(browserWidth + (event.key === 'ArrowLeft' ? 32 : -32));
  };

  const toggleMaximize = () => {
    applyWidth(maximized ? previousSplitWidthRef.current : containerWidth);
  };

  return (
    <div ref={containerRef} className="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden" data-testid="browser-workspace-layout">
      {chatWidth > 0 && (
        <section
          className="min-w-0 overflow-hidden border-r border-gray-200/80 dark:border-white/[0.08]"
          style={{ width: chatWidth }}
          aria-label="Chat con SofLIA"
        >
          {props.chat}
        </section>
      )}
      <section className="relative min-w-0 overflow-hidden bg-background dark:bg-background-dark" style={{ width: browserWidth || '100%' }}>
        {!maximized && (
          <div
            role="separator"
            aria-label="Ajustar ancho del navegador"
            aria-orientation="vertical"
            aria-valuemin={MIN_BROWSER_WIDTH}
            aria-valuemax={containerWidth}
            aria-valuenow={browserWidth}
            tabIndex={0}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onKeyDown={handleKeyDown}
            className="absolute inset-y-0 left-0 z-30 w-2 -translate-x-1 cursor-col-resize touch-none outline-none after:absolute after:inset-y-0 after:left-1/2 after:w-px after:bg-gray-300 hover:after:w-0.5 hover:after:bg-accent focus:after:w-0.5 focus:after:bg-accent dark:after:bg-white/15"
          />
        )}
        <IntegratedBrowserPanel onClose={props.onClose} maximized={maximized} onToggleMaximize={toggleMaximize} />
      </section>
    </div>
  );
}

function readStoredWidth(): number {
  const value = Number(localStorage.getItem(STORAGE_KEY));
  return Number.isFinite(value) && value >= MIN_BROWSER_WIDTH ? Math.round(value) : 760;
}

function resolveBrowserWidth(preferred: number, container: number): number {
  if (container <= 0) return Math.max(MIN_BROWSER_WIDTH, preferred);
  if (container <= MIN_BROWSER_WIDTH + MIN_CHAT_WIDTH) return container;
  const normalized = Math.max(MIN_BROWSER_WIDTH, Math.min(Math.round(preferred), container));
  return normalized > container - MIN_CHAT_WIDTH ? container : normalized;
}
