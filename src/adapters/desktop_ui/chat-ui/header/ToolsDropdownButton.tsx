import { useEffect, useRef, useState } from 'react';
import type { ActiveView } from '../../../../app/app-types';
import { usePresentationWorkspaceContext } from '../../../../contexts/presentation-workspace-context';

interface ToolsDropdownButtonProps {
  activeView?: ActiveView;
  browserOpen?: boolean;
  onOpenBrowser?: () => void;
  onOpenMeetings?: () => void;
  onOpenSdo?: () => void;
}

export function ToolsDropdownButton({
  onOpenBrowser,
  onOpenMeetings,
  onOpenSdo,
}: ToolsDropdownButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const presentation = usePresentationWorkspaceContext();
  const canReopenPresentation = presentation.hasPresentation && !presentation.visible;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!onOpenBrowser && !onOpenMeetings && !onOpenSdo && !canReopenPresentation) {
    return null;
  }

  return (
    <div className="relative inline-block text-left" ref={dropdownRef} style={{ fontFamily: 'var(--font-system-ui)' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Abrir menú de herramientas"
        className={`flex h-8 w-8 items-center justify-center rounded-full transition-all duration-150 focus:outline-none ${
          isOpen
            ? 'bg-accent/15 text-accent shadow-xs'
            : 'text-gray-500 hover:text-accent dark:text-white/70 dark:hover:text-accent hover:bg-gray-100/70 dark:hover:bg-white/[0.08]'
        }`}
        title="Herramientas (Navegador, Reuniones, Registro de decisiones)"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.6 9h16.8M3.6 15h16.8M12 3c2.1 2.45 3.2 5.45 3.2 9S14.1 18.55 12 21M12 3C9.9 5.45 8.8 8.45 8.8 12S9.9 18.55 12 21" />
        </svg>
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-60 overflow-hidden rounded-2xl border border-gray-200/80 dark:border-white/10 bg-white/95 dark:bg-[#161b22]/95 p-1.5 shadow-[0_1.5rem_4rem_rgba(2,12,23,0.32)] backdrop-blur-2xl animate-in fade-in slide-in-from-top-2 duration-150"
        >
          <div
            className="px-2.5 py-1.5 text-[9.5px] font-bold uppercase tracking-[0.16em] text-gray-400 dark:text-white/40"
            style={{ fontFamily: 'var(--font-system-label)' }}
          >
            Herramientas Integradas
          </div>
          <div className="flex flex-col gap-0.5">
            {onOpenBrowser && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsOpen(false);
                  onOpenBrowser();
                }}
                className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-semibold hover:bg-gray-100/80 dark:hover:bg-white/[0.06] text-gray-800 dark:text-white/90 transition-all duration-150 group"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10 border border-accent/20 text-accent group-hover:bg-accent group-hover:text-on-accent transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <circle cx="12" cy="12" r="9" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.6 9h16.8M3.6 15h16.8M12 3c2.1 2.45 3.2 5.45 3.2 9S14.1 18.55 12 21M12 3C9.9 5.45 8.8 8.45 8.8 12S9.9 18.55 12 21" />
                    </svg>
                  </span>
                  <span>Navegador</span>
                </div>
                <span
                  className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-white/45"
                  style={{ fontFamily: 'var(--font-system-label)' }}
                >
                  Ctrl+T
                </span>
              </button>
            )}

            {onOpenMeetings && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsOpen(false);
                  onOpenMeetings();
                }}
                className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-semibold hover:bg-gray-100/80 dark:hover:bg-white/[0.06] text-gray-800 dark:text-white/90 transition-all duration-150 group"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-500 dark:text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                    </svg>
                  </span>
                  <span>Reuniones</span>
                </div>
                <span
                  className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-white/45"
                  style={{ fontFamily: 'var(--font-system-label)' }}
                >
                  Ctrl+M
                </span>
              </button>
            )}

            {canReopenPresentation && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsOpen(false);
                  presentation.show();
                }}
                className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-semibold hover:bg-gray-100/80 dark:hover:bg-white/[0.06] text-gray-800 dark:text-white/90 transition-all duration-150 group"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 dark:text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h18v11H3z M12 16v3 M9 19h6" />
                    </svg>
                  </span>
                  <span>Presentación</span>
                </div>
              </button>
            )}

            {onOpenSdo && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsOpen(false);
                  onOpenSdo();
                }}
                className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-semibold hover:bg-gray-100/80 dark:hover:bg-white/[0.06] text-gray-800 dark:text-white/90 transition-all duration-150 group"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-500 dark:text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7 3h10a2 2 0 012 2v16l-2-1-2 1-2-1-2 1-2-1-2 1V5a2 2 0 012-2z" />
                    </svg>
                  </span>
                  <span>Decisiones (SDO)</span>
                </div>
                <span
                  className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-white/45"
                  style={{ fontFamily: 'var(--font-system-label)' }}
                >
                  Ctrl+D
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

