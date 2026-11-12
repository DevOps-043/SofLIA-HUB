import { HubGlyph } from '../ui/HubGlyph';
import './user-menu.css';
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
  organizationsUnavailableMessage?: string | null;
  onRetryOrganizations?: () => Promise<boolean>;
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
  organizationsUnavailableMessage,
  onRetryOrganizations,
  theme,
  onSetTheme,
  onOpenSettings,
  onSignOut,
}: UserMenuProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const [retryingOrgs, setRetryingOrgs] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;
    const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') { setIsMenuOpen(false); setThemeDropdownOpen(false); setOrgDropdownOpen(false); triggerRef.current?.focus(); } };
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  }, [isMenuOpen]);


  const closeMenu = () => {
    setIsMenuOpen(false);
    setThemeDropdownOpen(false);
    setOrgDropdownOpen(false);
  };

  return (
    <div className="relative flex-shrink-0 border-t border-gray-200/60 dark:border-white/10 p-2" style={{ fontFamily: 'var(--font-system-ui)' }}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => {
          if (!sidebarOpen && onToggleSidebar) {
            onToggleSidebar();
          }
          setThemeDropdownOpen(false);
          setOrgDropdownOpen(false);
          setIsMenuOpen((open) => !open);
        }}
        ref={triggerRef}
        aria-haspopup="dialog"
        aria-expanded={isMenuOpen}
        aria-label={`Menú de usuario. Usuario actual: ${displayName}`}
        className={`flex min-h-[2.25rem] w-full items-center rounded-xl text-left transition-all duration-150 hover:bg-gray-100/80 dark:hover:bg-white/[0.06] focus:outline-none ${
          sidebarOpen ? 'gap-2.5 px-2 py-1' : 'justify-center px-0 py-1'
        }`}
        title={orgName || displayName}
      >
        <OrgAvatar avatarUrl={avatarUrl} displayName={displayName} initials={initials} orgLogoUrl={orgLogoUrl} />
        {sidebarOpen && (
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[#0A2540] dark:text-white/90">
              {orgName || displayName}
            </span>
            <HubGlyph name="chevron" size={16} className={isMenuOpen ? 'rotate-180' : ''} />
          </div>
        )}
      </button>

      {/* Dropdown menu */}
      {isMenuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeMenu} />
          <div
            ref={menuRef}
            role="dialog" aria-label="Menú de usuario"
            className={`account-menu absolute bottom-full z-[100] mb-2 overflow-visible rounded-2xl border border-gray-200/60 bg-white p-1 shadow-[0_12px_40px_rgba(0,0,0,0.12)] backdrop-blur-xl animate-in fade-in slide-in-from-bottom-3 duration-150 dark:border-white/[0.08] dark:bg-[#161B22] dark:shadow-[0_12px_48px_rgba(0,0,0,0.5)] ${
              position === 'bottom'
                ? 'right-0 left-auto w-[220px]'
                : sidebarOpen
                ? 'left-2 w-[calc(100%-16px)]'
                : 'left-2 w-[220px]'
            }`}
          >
            {/* SOFIA no respondio: sin directorio no hay a que cambiar, asi que se
                dice por que falta el selector en vez de dejar el menu mudo. */}
            {organizations.length === 0 && organizationsUnavailableMessage && (
              <div className="relative">
                {onRetryOrganizations ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (retryingOrgs) return;
                      setRetryingOrgs(true);
                      void onRetryOrganizations().finally(() => setRetryingOrgs(false));
                    }}
                    disabled={retryingOrgs}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[11.5px] font-medium text-amber-700 transition-colors hover:bg-amber-50 disabled:opacity-60 dark:text-amber-300/90 dark:hover:bg-amber-400/10"
                  >
                    <span className="min-w-0 flex-1">
                      {organizationsUnavailableMessage}{' '}
                      <span className="underline">{retryingOrgs ? 'Reintentando…' : 'Reintentar'}</span>
                    </span>
                  </button>
                ) : (
                  <p className="px-3 py-2 text-[11.5px] font-medium text-amber-700 dark:text-amber-300/90">
                    {organizationsUnavailableMessage}
                  </p>
                )}
                <div className="mx-2 my-1 h-px bg-gray-200/80 dark:bg-white/[0.06]" />
              </div>
            )}

            {/* Organizations dropdown */}
            {organizations.length > 1 && onSelectOrganization && (
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setOrgDropdownOpen((open) => !open); }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-white/80 dark:hover:bg-white/[0.06] dark:hover:text-white"
                >
                  <OrgListIcon name={orgName || 'Soflia Hub'} logoUrl={orgLogoUrl} active={true} />
                  <span className="min-w-0 flex-1 truncate text-left">{orgName || 'Soflia Hub'}</span>
                  <HubGlyph name="chevron" size={14} className={orgDropdownOpen ? 'rotate-180' : ''} />
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
                            <HubGlyph name="check" size={16} className="ml-auto text-accent" />
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
              className="account-menu-row flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-white/80 dark:hover:bg-white/[0.06] dark:hover:text-white"
            >
              <span className="account-menu-glyph"><HubGlyph name="settings" size={20} /></span>
              <span>Configuración</span>
            </button>

            {/* Theme dropdown */}
            <div className="relative">
              <button
                aria-expanded={themeDropdownOpen}
                onClick={(e) => { e.stopPropagation(); setThemeDropdownOpen((open) => !open); }}
                className="account-menu-row flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-white/80 dark:hover:bg-white/[0.06] dark:hover:text-white"
              >
                <span className="account-menu-glyph"><ThemeIcon mode={theme} /></span>
                <span className="flex-1 text-left">Apariencia</span>
                <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500 dark:bg-white/[0.06] dark:text-white/40">
                  {themeLabels[theme]}
                </span>
                <HubGlyph name="chevron" size={14} className={themeDropdownOpen ? 'rotate-180' : ''} />
              </button>

              {/* Theme sub-dropdown */}
              {themeDropdownOpen && (
                <div className="account-theme-options" role="group" aria-label="Tema de la interfaz">
                  {(['light', 'system', 'dark'] as ThemeMode[]).map((mode) => (
                    <button
                      key={mode}
                      aria-pressed={theme === mode}
                      onClick={(e) => { e.stopPropagation(); onSetTheme(mode); setThemeDropdownOpen(false); }}
                      className={`account-theme-option ${
                        theme === mode
                          ? 'bg-accent/10 text-accent dark:bg-accent/15'
                          : 'text-gray-600 hover:bg-gray-100 dark:text-white/60 dark:hover:bg-white/[0.05]'
                      }`}
                    >
                      <ThemeIcon mode={mode} small />
                      <span>{themeLabels[mode]}</span>

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
              className="account-menu-row flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-red-500 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
            >
              <span className="account-menu-glyph"><HubGlyph name="logout" size={20} /></span>
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
      <div className="grid h-9.5 w-9.5 shrink-0 place-items-center overflow-hidden rounded-full bg-white ring-1 ring-gray-200 dark:bg-white/[0.08] dark:ring-white/15">
        <img src={orgLogoUrl} alt="Logo organizacion" className="h-full w-full object-contain p-1" />
      </div>
    );
  }

  return (
    <div
      className="grid h-9.5 w-9.5 shrink-0 place-items-center overflow-hidden rounded-full bg-accent/15 text-[12.5px] font-bold text-accent dark:bg-accent/20 dark:text-accent ring-1 ring-accent/30"
      style={{ fontFamily: 'var(--font-system-label)' }}
      title={displayName}
    >
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
  return <HubGlyph name={mode === 'light' ? 'sun' : mode === 'dark' ? 'moon' : 'monitor'} size={small ? 18 : 20} />;
}
