import { useEffect, useRef, useState } from 'react';
import type { ActiveView } from '../../../../app/app-types';

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!onOpenBrowser && !onOpenMeetings && !onOpenSdo) {
    return null;
  }

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-200 ${
          isOpen
            ? 'bg-accent/20 text-accent ring-1 ring-accent/30 dark:bg-accent/25 dark:text-accent'
            : 'bg-gray-100/80 text-gray-700 hover:bg-gray-200/80 dark:bg-white/[0.04] dark:text-white/80 dark:hover:bg-white/[0.08] border border-gray-200/50 dark:border-white/[0.06]'
        }`}
        title="Herramientas (Navegador, Reuniones, Registro de decisiones)"
      >
        <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.6 9h16.8M3.6 15h16.8M12 3c2.1 2.45 3.2 5.45 3.2 9S14.1 18.55 12 21M12 3C9.9 5.45 8.8 8.45 8.8 12S9.9 18.55 12 21" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-gray-200/80 bg-white/95 p-1.5 shadow-2xl backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#161B22]/95 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-white/35">
            Herramientas
          </div>
          <div className="flex flex-col gap-0.5">
            {onOpenBrowser && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenBrowser();
                }}
                className="flex items-center justify-between w-full px-2.5 py-2 rounded-xl text-xs font-semibold hover:bg-gray-100 dark:hover:bg-white/[0.06] text-gray-700 dark:text-white transition-colors"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="9" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.6 9h16.8M3.6 15h16.8M12 3c2.1 2.45 3.2 5.45 3.2 9S14.1 18.55 12 21M12 3C9.9 5.45 8.8 8.45 8.8 12S9.9 18.55 12 21" />
                  </svg>
                  <span>Navegador</span>
                </div>
                <span className="text-[10px] font-bold text-gray-400 dark:text-white/40">Ctrl+T</span>
              </button>
            )}

            {onOpenMeetings && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenMeetings();
                }}
                className="flex items-center justify-between w-full px-2.5 py-2 rounded-xl text-xs font-semibold hover:bg-gray-100 dark:hover:bg-white/[0.06] text-gray-700 dark:text-white transition-colors"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                  </svg>
                  <span>Reuniones</span>
                </div>
                <span className="text-[10px] font-bold text-gray-400 dark:text-white/40">Ctrl+M</span>
              </button>
            )}

            {onOpenSdo && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenSdo();
                }}
                className="flex items-center justify-between w-full px-2.5 py-2 rounded-xl text-xs font-semibold hover:bg-gray-100 dark:hover:bg-white/[0.06] text-gray-700 dark:text-white transition-colors"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7 3h10a2 2 0 012 2v16l-2-1-2 1-2-1-2 1-2-1-2 1V5a2 2 0 012-2z" />
                  </svg>
                  <span>Registro de decisiones</span>
                </div>
                <span className="text-[10px] font-bold text-gray-400 dark:text-white/40">Ctrl+D</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
