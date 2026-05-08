import { useState, type ReactNode } from 'react';
import type { ThemeMode } from '../../hooks/useTheme';

interface UserMenuProps {
  isOpen: boolean;
  displayName: string;
  initials: string;
  userEmail: string | undefined;
  avatarUrl: string | undefined;
  orgLogoUrl: string | undefined;
  theme: ThemeMode;
  onSetTheme: (t: ThemeMode) => void;
  onOpenSettings: () => void;
  onSignOut: () => void;
}

const themeOptions: Array<{ id: ThemeMode; icon: ReactNode }> = [
  { id: 'light', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> },
  { id: 'system', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg> },
  { id: 'dark', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> },
];

function CurrentThemeIcon({ theme }: { theme: ThemeMode }) {
  if (theme === 'light') {
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>;
  }
  if (theme === 'dark') {
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;
  }
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>;
}

export function UserMenu({
  isOpen: sidebarOpen,
  displayName,
  initials,
  userEmail,
  avatarUrl,
  orgLogoUrl,
  theme,
  onSetTheme,
  onOpenSettings,
  onSignOut,
}: UserMenuProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isThemeSubMenuOpen, setIsThemeSubMenuOpen] = useState(false);

  return (
    <div className="h-[73px] px-2 border-t border-gray-200 dark:border-white/10 relative flex-shrink-0 flex items-center box-border bg-gray-50 dark:bg-transparent">
      <div className={`w-full flex items-center ${sidebarOpen ? "gap-3 px-2" : "justify-center px-0"} text-sm text-gray-700 dark:text-gray-300`}>
        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className={`flex items-center gap-3 w-full text-left hover:bg-gray-200 dark:hover:bg-white/5 rounded-lg p-1.5 transition-colors ${!sidebarOpen && "justify-center"}`}>
          {orgLogoUrl ? <img src={orgLogoUrl} alt="Org Logo" className="w-8 h-8 object-contain shrink-0" /> : (
            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs font-bold flex-shrink-0 overflow-hidden" title={displayName}>
              {avatarUrl ? <img src={avatarUrl} alt="User" className="w-full h-full object-cover" /> : initials}
            </div>
          )}
          {sidebarOpen && (
            <div className="flex-1 min-w-0 flex items-center justify-between">
              <div className="font-medium text-gray-900 dark:text-white truncate">{displayName}</div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-gray-400 dark:text-gray-500 transition-transform ${isMenuOpen ? "rotate-180" : ""}`}><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
          )}
        </button>
        {isMenuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} />
            <div className={`absolute bottom-full translate-y-[-8px] bg-white dark:bg-[#1E1E1E] backdrop-blur-xl border border-gray-200/50 dark:border-white/10 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.2)] dark:shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-[100] py-1.5 animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200 ring-1 ring-black/5 ${sidebarOpen ? "left-1.5 w-[calc(100%-12px)]" : "left-2 w-[240px]"} ${isThemeSubMenuOpen ? '' : 'overflow-hidden'}`}>
              {!sidebarOpen && <div className="px-4 py-3 mb-1.5 border-b border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]"><div className="font-bold text-gray-900 dark:text-gray-100 truncate text-[13px]">{displayName}</div><div className="text-[10.5px] text-gray-500 truncate dark:text-gray-400 font-medium">{userEmail}</div></div>}
              <div className="px-1.5 space-y-0.5">
                <button onClick={() => { onOpenSettings(); setIsMenuOpen(false); }} className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-medium text-gray-700 dark:text-gray-300 hover:text-accent dark:hover:text-accent hover:bg-accent/5 transition-all group/item">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center group-hover/item:bg-accent/10 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5 text-gray-400 dark:text-gray-500 group-hover/item:text-accent transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><circle cx="12" cy="12" r="3" /></svg></div>
                  Configuración
                </button>
                <div className="px-3 py-1 mt-0.5 border-t border-gray-100 dark:border-white/5 flex items-center justify-between">
                  <div className="text-[13px] font-medium text-gray-700 dark:text-gray-300 ml-0.5">Apariencia</div>
                  <div className="relative">
                    <button onClick={(e) => { e.stopPropagation(); setIsThemeSubMenuOpen(!isThemeSubMenuOpen); }} className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${isThemeSubMenuOpen ? 'bg-accent/10 text-accent' : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 hover:bg-accent/5 hover:text-accent border border-gray-200 dark:border-white/5'}`}>
                      <CurrentThemeIcon theme={theme} />
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className={`ml-1 opacity-60 transition-transform ${isThemeSubMenuOpen ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </button>
                    {isThemeSubMenuOpen && (
                      <div className="absolute right-0 bottom-full mb-3 p-1 bg-white dark:bg-[#252525] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl flex gap-1 z-[60] animate-in fade-in slide-in-from-bottom-2 duration-150 ring-1 ring-black/5">
                        {themeOptions.map((opt) => (
                          <button key={opt.id} onClick={(e) => { e.stopPropagation(); onSetTheme(opt.id); setIsThemeSubMenuOpen(false); }} className={`w-8.5 h-8.5 flex items-center justify-center rounded-xl transition-all ${theme === opt.id ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                            {opt.icon}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="h-px bg-gray-100 dark:bg-white/5 my-1 mx-2" />
                <button onClick={onSignOut} className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-medium text-danger hover:bg-danger/5 transition-all group/logout">
                  <div className="w-8 h-8 rounded-lg bg-danger/5 flex items-center justify-center group-hover/logout:bg-danger/10 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5 text-danger opacity-70 group-hover/logout:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg></div>
                  Cerrar Sesión
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
