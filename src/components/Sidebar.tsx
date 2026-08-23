import { useEffect, useState } from 'react';
import { UserMenu } from './sidebar/UserMenu';
import { SidebarHeader } from './sidebar/SidebarHeader';
import { SidebarTopActions } from './sidebar/SidebarTopActions';
import { UnifiedProjectsSection } from './sidebar/UnifiedProjectsSection';
import { FolderSection } from './sidebar/FolderSection';
import { UngroupedChats } from './sidebar/UngroupedChats';
import { PinnedChats } from './sidebar/PinnedChats';
import { SearchChatsModal } from './sidebar/SearchChatsModal';
import type { SidebarProps } from './sidebar/types';

export type { SidebarProps } from './sidebar/types';

const DEFAULT_SIDEBAR_WIDTH = 276;
const MIN_SIDEBAR_WIDTH = 220;
const MAX_SIDEBAR_WIDTH = 520;

export function Sidebar(props: SidebarProps) {
  const { isOpen, onToggle, onNewChat, onCreateFolderClick } = props;
  const [foldersOpen, setFoldersOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('sofLia_sidebarWidth');
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed >= MIN_SIDEBAR_WIDTH && parsed <= MAX_SIDEBAR_WIDTH) {
          return parsed;
        }
      }
    } catch {
      // Fallback
    }
    return DEFAULT_SIDEBAR_WIDTH;
  });

  const [isResizing, setIsResizing] = useState(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return undefined;

    const handlePointerMove = (e: PointerEvent) => {
      let newWidth = e.clientX;
      if (props.position === 'right') {
        newWidth = window.innerWidth - e.clientX;
      }
      const clamped = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, newWidth));
      setSidebarWidth(clamped);
    };

    const handlePointerUp = () => {
      setIsResizing(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing, props.position]);

  useEffect(() => {
    if (!isResizing) {
      try {
        localStorage.setItem('sofLia_sidebarWidth', sidebarWidth.toString());
      } catch {
        // Fallback
      }
    }
  }, [isResizing, sidebarWidth]);

  if (props.position === 'bottom') {
    return (
      <>
        {(foldersOpen || projectsOpen) && (
          <div className="fixed inset-0 z-40" onClick={() => { setFoldersOpen(false); setProjectsOpen(false); }} />
        )}
        <aside className="w-full h-15 flex-shrink-0 p-1.5 bg-background dark:bg-background-dark text-gray-700 dark:text-white transition-all z-30">
          <div className="h-full overflow-visible rounded-2xl border border-gray-200/85 bg-white/80 shadow-[0_4px_20px_rgba(10,37,64,0.06)] backdrop-blur-xl dark:border-white/[0.07] dark:bg-[rgba(10,13,18,0.92)] dark:shadow-[0_4px_25px_rgba(0,0,0,0.3)]">
            <div className="flex h-full flex-row items-center justify-between px-3 gap-4">
              
              {/* Left: Start / Logo */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-[#0A2540]/10 dark:bg-white/[0.04]">
                  <img src="./assets/Icono.png" alt="Pulse Hub" className="h-5 w-5 object-contain" />
                </div>
                <span className="hidden sm:inline text-xs font-bold tracking-wide text-[#0A2540] dark:text-white">Pulse Hub</span>
              </div>

              {/* Middle Left: Action button & Popovers group */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={onNewChat}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0A2540] text-white shadow-[0_4px_12px_rgba(10,37,64,0.12)] hover:bg-[#0D2F4D] dark:bg-accent dark:text-on-accent dark:shadow-[0_4px_12px_rgba(0,212,179,0.15)] dark:hover:bg-[#22E0C3] text-xs font-bold rounded-lg active:scale-[0.98] transition-all shrink-0"
                >
                  <span className="text-sm font-semibold leading-none">+</span>
                  <span className="hidden md:inline">Nuevo Chat</span>
                </button>

                {/* Buscar chats button */}
                <button
                  onClick={() => setIsSearchOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200/50 dark:border-white/[0.06] text-gray-600 hover:text-gray-900 dark:text-white/70 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.04] transition-all duration-200 shrink-0"
                  title="Buscar chats"
                >
                  <svg className="w-3.5 h-3.5 text-gray-400 dark:text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <circle cx="11" cy="11" r="8" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
                  </svg>
                  <span className="hidden md:inline">Buscar</span>
                </button>

                {/* Carpetas Popover Button */}
                <div className="relative shrink-0">
                  <button
                    onClick={() => { setFoldersOpen(!foldersOpen); setProjectsOpen(false); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200 ${
                      foldersOpen
                        ? 'bg-accent/10 border-accent/20 text-accent font-bold shadow-sm'
                        : 'bg-transparent border-gray-200/50 dark:border-white/[0.06] text-gray-600 hover:text-gray-900 dark:text-white/70 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.04]'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    <span className="hidden md:inline">Carpetas</span>
                  </button>

                  {foldersOpen && (
                    <div className="absolute bottom-full left-0 mb-2.5 z-50 w-72 bg-white/95 dark:bg-[#161B22]/95 border border-gray-200/60 dark:border-white/[0.08] rounded-2xl shadow-2xl p-3 max-h-[70vh] overflow-y-auto sidebar-scrollbar backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-150">
                      <div className="flex flex-col gap-1">
                        <FolderSection props={{ ...props, isOpen: true }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* WorkSpaces Popover Button */}
                <div className="relative shrink-0">
                  <button
                    onClick={() => { setProjectsOpen(!projectsOpen); setFoldersOpen(false); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200 ${
                      projectsOpen
                        ? 'bg-accent/10 border-accent/20 text-accent font-bold shadow-sm'
                        : 'bg-transparent border-gray-200/50 dark:border-white/[0.06] text-gray-600 hover:text-gray-900 dark:text-white/70 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.04]'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                    <span className="hidden md:inline">WorkSpaces</span>
                  </button>

                  {projectsOpen && (
                    <div className="absolute bottom-full left-0 mb-2.5 z-50 w-72 bg-white/95 dark:bg-[#161B22]/95 border border-gray-200/60 dark:border-white/[0.08] rounded-2xl shadow-2xl p-3 max-h-[70vh] overflow-y-auto sidebar-scrollbar backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-150">
                      <div className="flex flex-col gap-1">
                        <UnifiedProjectsSection props={{ ...props, isOpen: true }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Panel de Herramientas (separado) */}
                {(props.onOpenBrowser || props.onOpenMeetings) && (
                  <div className="flex items-center gap-1 p-1 rounded-xl bg-gray-100/70 border border-gray-200/50 dark:bg-white/[0.03] dark:border-white/[0.06] shrink-0">
                    {props.onOpenBrowser && (
                      <button
                        onClick={props.onOpenBrowser}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all duration-200 shrink-0 ${
                          props.browserOpen
                            ? 'bg-white text-[#0A2540] shadow-sm font-bold dark:bg-accent/20 dark:text-accent'
                            : 'text-gray-600 hover:text-gray-900 dark:text-white/70 dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/[0.04]'
                        }`}
                        title="Navegador integrado"
                      >
                        <BrowserNavigationIcon className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">Navegador</span>
                      </button>
                    )}

                    {props.onOpenMeetings && (
                      <button
                        onClick={props.onOpenMeetings}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all duration-200 shrink-0 ${
                          props.activeView === 'meetings'
                            ? 'bg-white text-[#0A2540] shadow-sm font-bold dark:bg-accent/20 dark:text-accent'
                            : 'text-gray-600 hover:text-gray-900 dark:text-white/70 dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/[0.04]'
                        }`}
                        title="Reuniones: transcripciones y minutas"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                        </svg>
                        <span className="hidden md:inline">Reuniones</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Middle: Horizontal scrolling conversations */}
              <div className="flex-1 min-w-0 overflow-x-auto no-scrollbar flex items-center gap-2 h-full py-1">
                {props.conversations.map((chat) => {
                  const active = chat.id === props.currentConversationId;
                  return (
                    <button
                      key={chat.id}
                      onClick={() => props.onSelectConversation(chat.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all border shrink-0 ${
                        active
                          ? 'bg-accent/10 border-accent/20 text-accent font-bold'
                          : 'bg-transparent border-transparent hover:bg-gray-100 dark:hover:bg-white/[0.04] text-gray-600 dark:text-white/70'
                      }`}
                      title={chat.title}
                    >
                      <span className="max-w-[120px] block truncate">{chat.title}</span>
                    </button>
                  );
                })}
              </div>

              {/* Right: User Menu */}
              <div className="relative shrink-0">
                <UserMenu
                  isOpen={true}
                  position="bottom"
                  displayName={props.displayName}
                  initials={props.initials}
                  userEmail={props.userEmail}
                  avatarUrl={props.avatarUrl}
                  orgName={props.orgName}
                  orgLogoUrl={props.orgLogoUrl}
                  organizations={props.organizations}
                  currentOrgId={props.currentOrgId}
                  onSelectOrganization={props.onSelectOrganization}
                  theme={props.theme}
                  onSetTheme={props.onSetTheme}
                  onOpenSettings={props.onOpenSettings}
                  onSignOut={props.onSignOut}
                />
              </div>

            </div>
          </div>
        </aside>

        <SearchChatsModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          conversations={props.conversations}
          onSelectConversation={props.onSelectConversation}
          onNewChat={props.onNewChat}
        />
      </>
    );
  }

  return (
    <>
      <aside
        style={{
          width: isOpen ? `${sidebarWidth}px` : '78px',
        }}
        className={`relative flex-shrink-0 h-full p-2.5 bg-background text-gray-700 dark:text-white ${
          isResizing ? 'select-none' : 'transition-[width] duration-300 ease-in-out'
        } z-30`}
      >
        <div className="h-full overflow-hidden rounded-2xl border border-gray-200/60 bg-white/80 shadow-[0_0.75rem_2.5rem_rgba(10,37,64,0.08)] backdrop-blur-xl saturate-[140%] dark:border-white/10 dark:bg-[#0a0e14]/90 dark:shadow-[0_0.75rem_2.5rem_rgba(0,0,0,0.38)]">
          <div className="flex h-full flex-col">
            <SidebarHeader isOpen={isOpen} onToggle={onToggle} />
            <SidebarTopActions
              isOpen={isOpen}
              onNewChat={onNewChat}
              onCreateFolderClick={onCreateFolderClick}
              onOpenSearch={() => setIsSearchOpen(true)}
            />

            {!isOpen && <div className="w-8 h-px bg-gray-200/60 dark:bg-white/10 my-2 self-center shrink-0" aria-hidden="true" />}

            {isOpen ? (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden pt-1">
                <div
                  className="px-3 pb-1 flex items-center justify-between text-[9.5px] font-bold tracking-[0.16em] uppercase text-gray-400 dark:text-white/35 shrink-0"
                  style={{ fontFamily: 'var(--font-system-label)' }}
                >
                  <span>Proyectos y Chats</span>
                </div>
                <nav className="flex-1 overflow-y-auto sidebar-scrollbar px-2 pb-2">
                  <PinnedChats props={props} />
                  <UnifiedProjectsSection props={props} />
                  <FolderSection props={props} />
                  <UngroupedChats props={props} />
                </nav>
              </div>
            ) : (
              <div className="flex-1" />
            )}

            <UserMenu
              isOpen={isOpen}
              onToggleSidebar={onToggle}
              displayName={props.displayName}
              initials={props.initials}
              userEmail={props.userEmail}
              avatarUrl={props.avatarUrl}
              orgName={props.orgName}
              orgLogoUrl={props.orgLogoUrl}
              organizations={props.organizations}
              currentOrgId={props.currentOrgId}
              onSelectOrganization={props.onSelectOrganization}
              theme={props.theme}
              onSetTheme={props.onSetTheme}
              onOpenSettings={props.onOpenSettings}
              onSignOut={props.onSignOut}
            />
          </div>
        </div>

        {/* Drag Handle de redimensionamiento */}
        {isOpen && (
          <div
            onPointerDown={handlePointerDown}
            className={`absolute ${props.position === 'right' ? '-left-1.5' : '-right-1.5'} top-0 bottom-0 w-3 cursor-col-resize group z-40 flex items-center justify-center`}
            title="Arrastra hacia la derecha o izquierda para cambiar el tamaño del menú"
          >
            <div
              className={`w-1 rounded-full transition-all duration-200 ${
                isResizing
                  ? 'h-24 bg-accent shadow-[0_0_12px_rgba(0,212,179,0.7)]'
                  : 'h-8 bg-gray-300/40 group-hover:h-16 group-hover:bg-accent/80 dark:bg-white/10 dark:group-hover:bg-accent/80'
              }`}
            />
          </div>
        )}
      </aside>

      <SearchChatsModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        conversations={props.conversations}
        onSelectConversation={props.onSelectConversation}
        onNewChat={props.onNewChat}
      />
    </>
  );
}

function BrowserNavigationIcon({ className }: { className: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.6 9h16.8M3.6 15h16.8M12 3c2.1 2.45 3.2 5.45 3.2 9S14.1 18.55 12 21M12 3C9.9 5.45 8.8 8.45 8.8 12S9.9 18.55 12 21" />
    </svg>
  );
}
