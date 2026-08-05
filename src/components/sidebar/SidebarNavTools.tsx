import type { SidebarProps } from './types';

interface SidebarNavToolsProps {
  isOpen: boolean;
  activeView: SidebarProps['activeView'];
  browserOpen?: boolean;
  onOpenBrowser?: () => void;
  onOpenMeetings?: () => void;
  onOpenSdo?: () => void;
}

export function SidebarNavTools({
  isOpen,
  activeView,
  browserOpen,
  onOpenBrowser,
  onOpenMeetings,
  onOpenSdo,
}: SidebarNavToolsProps) {
  if (!onOpenBrowser && !onOpenMeetings && !onOpenSdo) {
    return null;
  }

  const items = [
    onOpenBrowser && {
      id: 'browser',
      label: 'Navegador',
      title: 'Navegador integrado compartido con la IA',
      icon: (className: string) => (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.6 9h16.8M3.6 15h16.8M12 3c2.1 2.45 3.2 5.45 3.2 9S14.1 18.55 12 21M12 3C9.9 5.45 8.8 8.45 8.8 12S9.9 18.55 12 21" />
        </svg>
      ),
      isActive: Boolean(browserOpen),
      onClick: onOpenBrowser,
      badge: 'Nativo',
    },
    onOpenMeetings && {
      id: 'meetings',
      label: 'Reuniones',
      title: 'Reuniones: transcripciones, minutas y ejecuciones',
      icon: (className: string) => (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
        </svg>
      ),
      isActive: activeView === 'meetings',
      onClick: onOpenMeetings,
      badge: 'Minutas',
    },
    onOpenSdo && {
      id: 'sdo',
      label: 'Registro de decisiones',
      title: 'Registro de decisiones oficiales del SDO',
      icon: (className: string) => (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7 3h10a2 2 0 012 2v16l-2-1-2 1-2-1-2 1-2-1-2 1V5a2 2 0 012-2z" />
        </svg>
      ),
      isActive: activeView === 'sdo',
      onClick: onOpenSdo,
      badge: 'SDO',
    },
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (!isOpen) {
    return (
      <div className="py-2 flex flex-col items-center gap-1.5 border-b border-gray-200/50 dark:border-white/[0.06]">
        {items.map((item) => {
          const Active = item.isActive;
          return (
            <button
              key={item.id}
              onClick={item.onClick}
              title={item.title}
              className={`relative group flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200 ${
                Active
                  ? 'bg-accent/15 text-accent shadow-sm ring-1 ring-accent/30'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-white/60 dark:hover:bg-white/[0.06] dark:hover:text-white'
              }`}
            >
              {item.icon('h-4 w-4')}
              {Active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-1 bg-accent rounded-r-full" />
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="px-3 py-2">
      <div className="rounded-2xl border border-gray-200/60 bg-gray-50/70 p-1.5 shadow-sm backdrop-blur-md dark:border-white/[0.07] dark:bg-white/[0.02]">
        <div className="px-2 py-1 flex items-center justify-between">
          <span className="text-[10px] font-bold tracking-wider uppercase text-gray-400 dark:text-white/35">
            Herramientas
          </span>
          <span className="h-1.5 w-1.5 rounded-full bg-accent/80 animate-pulse" title="Herramientas disponibles" />
        </div>
        <div className="flex flex-col gap-1 mt-0.5">
          {items.map((item) => {
            const Active = item.isActive;
            return (
              <button
                key={item.id}
                onClick={item.onClick}
                title={item.title}
                className={`group relative flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-xs font-semibold transition-all duration-200 ${
                  Active
                    ? 'bg-white text-[#0A2540] shadow-sm border border-gray-200/80 dark:bg-accent/15 dark:text-accent dark:border-accent/30 dark:shadow-[0_0_12px_rgba(0,212,179,0.12)] font-bold'
                    : 'text-gray-600 hover:bg-white/80 hover:text-gray-900 dark:text-white/70 dark:hover:bg-white/[0.05] dark:hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
                      Active
                        ? 'bg-[#0A2540]/10 text-[#0A2540] dark:bg-accent/20 dark:text-accent'
                        : 'bg-gray-200/50 text-gray-500 group-hover:bg-gray-200 group-hover:text-gray-700 dark:bg-white/[0.05] dark:text-white/50 dark:group-hover:bg-white/[0.1] dark:group-hover:text-white'
                    }`}
                  >
                    {item.icon('h-3.5 w-3.5')}
                  </div>
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md transition-colors ${
                      Active
                        ? 'bg-[#0A2540]/10 text-[#0A2540] dark:bg-accent/25 dark:text-accent'
                        : 'bg-gray-200/60 text-gray-500 dark:bg-white/[0.06] dark:text-white/40'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
