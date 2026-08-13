import { useState } from 'react';
import type { ActiveView } from '../app/app-types';

interface RightToolsPanelProps {
  activeView: ActiveView;
  browserOpen?: boolean;
  onOpenBrowser?: () => void;
  onOpenMeetings?: () => void;
  onOpenChat?: () => void;
}

export function RightToolsPanel({
  activeView,
  browserOpen,
  onOpenBrowser,
  onOpenMeetings,
  onOpenChat,
}: RightToolsPanelProps) {
  const [isOpen, setIsOpen] = useState(true);

  const tools = [
    {
      id: 'chat',
      label: 'Chat Principal',
      shortcut: 'Ctrl+Alt+S',
      description: 'Conversación directa con SofLIA',
      badge: 'IA',
      isActive: activeView === 'chat' && !browserOpen,
      onClick: onOpenChat,
      icon: (className: string) => (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
    },
    {
      id: 'browser',
      label: 'Navegador',
      shortcut: 'Ctrl+T',
      description: 'Navegador web integrado compartido',
      badge: 'Nativo',
      isActive: Boolean(browserOpen),
      onClick: onOpenBrowser,
      icon: (className: string) => (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.6 9h16.8M3.6 15h16.8M12 3c2.1 2.45 3.2 5.45 3.2 9S14.1 18.55 12 21M12 3C9.9 5.45 8.8 8.45 8.8 12S9.9 18.55 12 21" />
        </svg>
      ),
    },
    {
      id: 'meetings',
      label: 'Reuniones',
      shortcut: 'Ctrl+M',
      description: 'Transcripciones, minutas y ejecuciones',
      badge: 'Minutas',
      isActive: activeView === 'meetings' && !browserOpen,
      onClick: onOpenMeetings,
      icon: (className: string) => (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
        </svg>
      ),
    },
  ];

  return (
    <aside
      className={`h-full flex-shrink-0 p-2 text-gray-700 dark:text-white transition-all duration-300 ease-in-out z-20 ${
        isOpen ? 'w-[250px]' : 'w-[64px]'
      }`}
    >
      <div className="h-full overflow-hidden rounded-[24px] border border-gray-200/80 bg-white/80 shadow-[0_18px_45px_rgba(10,37,64,0.10)] backdrop-blur-xl dark:border-white/[0.07] dark:bg-[rgba(10,13,18,0.92)] dark:shadow-[0_18px_55px_rgba(0,0,0,0.42)]">
        <div className="flex h-full flex-col">
          {/* Header Panel Derecho */}
          <div className="flex h-14 items-center justify-between px-3 border-b border-gray-200/50 dark:border-white/[0.06]">
            {isOpen ? (
              <div className="flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-accent/15 text-accent">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </div>
                <span className="text-xs font-bold tracking-wide uppercase text-gray-800 dark:text-white">
                  Herramientas
                </span>
              </div>
            ) : (
              <div className="mx-auto grid h-7 w-7 place-items-center rounded-lg bg-accent/15 text-accent">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </div>
            )}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:text-white/50 dark:hover:bg-white/[0.06] dark:hover:text-white transition-all"
              title={isOpen ? 'Colapsar panel de herramientas' : 'Expandir panel de herramientas'}
            >
              <svg
                className={`h-4 w-4 transition-transform duration-300 ${isOpen ? '' : 'rotate-180'}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Lista de Herramientas Estilo Codex */}
          <div className="flex-1 p-2 space-y-1.5 overflow-y-auto sidebar-scrollbar">
            {tools.map((item) => {
              if (!item.onClick) return null;
              const Active = item.isActive;
              return (
                <button
                  key={item.id}
                  onClick={item.onClick}
                  title={item.description}
                  className={`group relative flex w-full items-center rounded-2xl transition-all duration-200 ${
                    isOpen ? 'p-2.5 justify-between' : 'h-10 justify-center'
                  } ${
                    Active
                      ? 'bg-[#0A2540] text-white shadow-lg ring-1 ring-accent/40 dark:bg-accent/15 dark:text-accent dark:shadow-[0_0_15px_rgba(0,212,179,0.15)] font-bold'
                      : 'hover:bg-gray-100 text-gray-700 dark:text-white/70 dark:hover:bg-white/[0.05] dark:hover:text-white border border-transparent'
                  }`}
                >
                  <div className={`flex items-center gap-2.5 min-w-0 ${!isOpen && 'justify-center'}`}>
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl transition-all ${
                        Active
                          ? 'bg-white/20 text-white dark:bg-accent/25 dark:text-accent'
                          : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200 group-hover:text-gray-900 dark:bg-white/[0.05] dark:text-white/60 dark:group-hover:bg-white/[0.1] dark:group-hover:text-white'
                      }`}
                    >
                      {item.icon('h-4 w-4')}
                    </div>
                    {isOpen && (
                      <div className="flex flex-col text-left min-w-0">
                        <span className="text-xs font-semibold truncate leading-tight">{item.label}</span>
                        <span
                          className={`text-[10px] truncate leading-tight ${
                            Active ? 'text-white/70 dark:text-accent/70' : 'text-gray-400 dark:text-white/40'
                          }`}
                        >
                          {item.shortcut}
                        </span>
                      </div>
                    )}
                  </div>

                  {isOpen && item.badge && (
                    <span
                      className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md transition-colors shrink-0 ${
                        Active
                          ? 'bg-white/20 text-white dark:bg-accent/25 dark:text-accent'
                          : 'bg-gray-200/60 text-gray-500 dark:bg-white/[0.06] dark:text-white/40'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}

                  {!isOpen && Active && (
                    <span className="absolute right-0 top-1/2 -translate-y-1/2 h-4 w-1 bg-accent rounded-l-full" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer del Panel Derecho */}
          {isOpen && (
            <div className="p-3 border-t border-gray-200/50 dark:border-white/[0.06] text-[10px] text-gray-400 dark:text-white/30 text-center">
              Pulse Hub Codex Tools
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
