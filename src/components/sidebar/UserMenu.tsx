import { useState, useRef, useEffect } from 'react';
import type { ThemeMode } from '../../hooks/useTheme';
import type { SofiaOrganization } from '../../lib/sofia-client';

interface UserMenuProps {
  isOpen: boolean;
  onToggleSidebar?: () => void;
  position?: 'left' | 'right' | 'bottom';
  displayName: string;
  initials: string;
  userEmail: string | undefined;
  avatarUrl: string | undefined;
  orgName: string | undefined;
  orgLogoUrl: string | undefined;
  organizations?: SofiaOrganization[];
  currentOrgId?: string;
  onSelectOrganization?: (orgId: string) => void;
  theme: ThemeMode;
  onSetTheme: (t: ThemeMode) => void;
  onOpenSettings: () => void;
  onSignOut: () => void;
}

const themeLabels: Record<ThemeMode, string> = {
  light: 'Claro',
  system: 'Sistema',
  dark: 'Oscuro',
};

export function UserMenu({
  isOpen: sidebarOpen,
  onToggleSidebar,
  position = 'left',
  displayName,
  initials,
  avatarUrl,
  orgName,
  orgLogoUrl,
  organizations = [],
  currentOrgId,
  onSelectOrganization,
  theme,
  onSetTheme,
  onOpenSettings,
  onSignOut,
}: UserMenuProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close sub-dropdowns when main menu closes
  useEffect(() => {
    if (!isMenuOpen) {
      setThemeDropdownOpen(false);
      setOrgDropdownOpen(false);
    }
  }, [isMenuOpen]);

  const closeMenu = () => {
    setIsMenuOpen(false);
    setThemeDropdownOpen(false);
    setOrgDropdownOpen(false);
  };

  return (
    <div className="relative flex-shrink-0 border-t border-gray-200/70 p-2 dark:border-white/[0.06]">
      {/* Trigger button */}
      <button
        onClick={() => {
          if (!sidebarOpen && onToggleSidebar) {
            onToggleSidebar();
          }
          setIsMenuOpen((open) => !open);
        }}
        className={`flex min-h-10 w-full items-center rounded-2xl text-left transition-all hover:bg-[#0A2540]/5 dark:hover:bg-white/[0.05] ${
          sidebarOpen ? 'gap-2.5 px-2' : 'justify-center px-0'
        }`}
        title={orgName || displayName}
      >
        <OrgAvatar avatarUrl={avatarUrl} displayName={displayName} initials={initials} orgLogoUrl={orgLogoUrl} />
        {sidebarOpen && (
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-[#0A2540] dark:text-white">
              {orgName || displayName}
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 text-gray-400 transition-transform duration-200 dark:text-white/30 ${isMenuOpen ? 'rotate-180' : ''}`}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        )}
      </button>

      {/* Dropdown menu */}
      {isMenuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeMenu} />
          <div
            ref={menuRef}
            className={`absolute bottom-full z-[100] mb-2 overflow-visible rounded-2xl border border-gray-200/60 bg-white p-1 shadow-[0_12px_40px_rgba(0,0,0,0.12)] backdrop-blur-xl animate-in fade-in slide-in-from-bottom-3 duration-150 dark:border-white/[0.08] dark:bg-[#161B22] dark:shadow-[0_12px_48px_rgba(0,0,0,0.5)] ${
              position === 'bottom'
                ? 'right-0 left-auto w-[220px]'
                : sidebarOpen
                ? 'left-2 w-[calc(100%-16px)]'
                : 'left-2 w-[220px]'
            }`}
          >
            {/* Organizations dropdown */}
            {organizations.length > 1 && onSelectOrganization && (
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setOrgDropdownOpen((open) => !open); }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-white/80 dark:hover:bg-white/[0.06] dark:hover:text-white"
                >
                  <OrgListIcon name={orgName || 'Pulse Hub'} logoUrl={orgLogoUrl} active={true} />
                  <span className="min-w-0 flex-1 truncate text-left">{orgName || 'Pulse Hub'}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`text-gray-400 transition-transform duration-150 dark:text-white/30 shrink-0 ${orgDropdownOpen ? 'rotate-180' : ''}`}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {/* Organizations sub-dropdown list */}
                {orgDropdownOpen && (
                  <div className="mx-1 mb-1 max-h-56 overflow-y-auto no-scrollbar rounded-xl border border-gray-100 bg-gray-50/80 dark:border-white/[0.04] dark:bg-white/[0.03]">
                    {organizations.map((org) => {
                      const active = org.id === currentOrgId;
                      return (
                        <button
                          key={org.id}
                          onClick={(e) => { e.stopPropagation(); if (!active) onSelectOrganization(org.id); closeMenu(); }}
                          className={`flex w-full items-center gap-3 px-3 py-2.5 text-[12.5px] font-medium transition-colors ${
                            active
                              ? 'bg-accent/10 text-accent dark:bg-accent/15'
                              : 'text-gray-600 hover:bg-gray-100 dark:text-white/60 dark:hover:bg-white/[0.05]'
                          }`}
                        >
                          <OrgListIcon name={org.name} logoUrl={org.brand_favicon_url} active={active} />
                          <span className="min-w-0 flex-1 truncate text-left">{org.name}</span>
                          {active && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="ml-auto text-accent shrink-0">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="mx-2 my-1 h-px bg-gray-200/80 dark:bg-white/[0.06]" />
              </div>
            )}

            {/* Settings */}
            <button
              onClick={(e) => { e.stopPropagation(); onOpenSettings(); closeMenu(); }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-white/80 dark:hover:bg-white/[0.06] dark:hover:text-white"
            >
              <SettingsIcon />
              <span>Configuración</span>
            </button>

            {/* Theme dropdown */}
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setThemeDropdownOpen((open) => !open); }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-white/80 dark:hover:bg-white/[0.06] dark:hover:text-white"
              >
                <ThemeIcon mode={theme} />
                <span className="flex-1 text-left">Apariencia</span>
                <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500 dark:bg-white/[0.06] dark:text-white/40">
                  {themeLabels[theme]}
                </span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`text-gray-400 transition-transform duration-150 dark:text-white/30 ${themeDropdownOpen ? 'rotate-180' : ''}`}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {/* Theme sub-dropdown */}
              {themeDropdownOpen && (
                <div className="mx-1 mb-1 overflow-hidden rounded-xl border border-gray-100 bg-gray-50/80 dark:border-white/[0.04] dark:bg-white/[0.03]">
                  {(['light', 'system', 'dark'] as ThemeMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={(e) => { e.stopPropagation(); onSetTheme(mode); setThemeDropdownOpen(false); }}
                      className={`flex w-full items-center gap-3 px-3 py-2 text-[12.5px] font-medium transition-colors ${
                        theme === mode
                          ? 'bg-accent/10 text-accent dark:bg-accent/15'
                          : 'text-gray-600 hover:bg-gray-100 dark:text-white/60 dark:hover:bg-white/[0.05]'
                      }`}
                    >
                      <ThemeIcon mode={mode} small />
                      <span>{themeLabels[mode]}</span>
                      {theme === mode && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="ml-auto text-accent">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="mx-2 my-1 h-px bg-gray-200/80 dark:bg-white/[0.06]" />

            {/* Sign out */}
            <button
              onClick={(e) => { e.stopPropagation(); onSignOut(); closeMenu(); }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-red-500 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
            >
              <LogoutIcon />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Sub-components ────────────────────────────────────────────────── */

function OrgAvatar({
  avatarUrl,
  displayName,
  initials,
  orgLogoUrl,
}: {
  avatarUrl: string | undefined;
  displayName: string;
  initials: string;
  orgLogoUrl: string | undefined;
}) {
  if (orgLogoUrl) {
    return (
      <div className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-xl bg-white shadow-[inset_0_0_0_1px_rgba(10,37,64,0.08)] dark:bg-white/[0.05] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
        <img src={orgLogoUrl} alt="Logo organizacion" className="h-full w-full object-contain p-1" />
      </div>
    );
  }

  return (
    <div className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#0A2540]/10 text-[11px] font-bold text-[#0A2540] dark:bg-accent/10 dark:text-accent" title={displayName}>
      {avatarUrl ? <img src={avatarUrl} alt="Usuario" className="h-full w-full object-cover" /> : initials}
    </div>
  );
}

function OrgListIcon({ name, logoUrl, active }: { name: string; logoUrl?: string; active: boolean }) {
  if (logoUrl) {
    return (
      <div className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-lg bg-white shadow-[inset_0_0_0_1px_rgba(10,37,64,0.08)] dark:bg-white/[0.05] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
        <img src={logoUrl} alt="" className="h-full w-full object-contain p-0.5" />
      </div>
    );
  }
  return (
    <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[11px] font-bold ${
      active ? 'bg-accent/15 text-accent' : 'bg-[#0A2540]/10 text-[#0A2540] dark:bg-white/[0.06] dark:text-white/70'
    }`}>
      {name.trim().charAt(0).toUpperCase() || '?'}
    </div>
  );
}

function ThemeIcon({ mode, small = false }: { mode: ThemeMode; small?: boolean }) {
  const size = small ? 14 : 16;
  const sw = small ? '2' : '2.2';
  if (mode === 'light') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
    );
  }
  if (mode === 'dark') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    );
  }
  // system
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}
