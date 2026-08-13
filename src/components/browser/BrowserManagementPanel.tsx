import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  integratedBrowserService,
  type BrowserCredentialMetadata,
  type BrowserExtensionInstallPreview,
  type BrowserExtensionMetadata,
  type BrowserHistoryEntry,
  type IntegratedBrowserDataResponse,
} from '../../services/integrated-browser-service';
import { BrowserConfirmDialog, BrowserDialog } from './BrowserDialog';
import { BrowserPrivacyPanel } from './BrowserPrivacyPanel';

export type BrowserManagementTab = 'history' | 'credentials' | 'extensions' | 'privacy';

const TAB_META: Record<BrowserManagementTab, { label: string; description: string; icon: ReactNode }> = {
  history: {
    label: 'Historial',
    description: 'Retoma páginas visitadas sin abandonar el navegador.',
    icon: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2M5 5l-2 2" /></svg>,
  },
  credentials: {
    label: 'Contraseñas',
    description: 'Credenciales cifradas y separadas por sitio.',
    icon: <svg viewBox="0 0 24 24"><circle cx="8" cy="15" r="4" /><path d="M11 12l8-8M15 8l2 2M17 6l2 2" /></svg>,
  },
  extensions: {
    label: 'Extensiones',
    description: 'Controla complementos compatibles y sus permisos.',
    icon: <svg viewBox="0 0 24 24"><path d="M8 3h5v5a2 2 0 104 0V3h4v7h-5a2 2 0 100 4h5v7h-7v-5a2 2 0 10-4 0v5H3v-7h5a2 2 0 100-4H3V3h5z" /></svg>,
  },
  privacy: {
    label: 'Privacidad',
    description: 'Borra historial, cookies, caché y credenciales de este perfil.',
    icon: <svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5" /></svg>,
  },
};

export function BrowserManagementPanel(props: {
  tab: BrowserManagementTab;
  onTabChange: (tab: BrowserManagementTab) => void;
  onClose: () => void;
  onFillCredential: (id: string) => Promise<IntegratedBrowserDataResponse>;
}) {
  const meta = TAB_META[props.tab];
  return (
    <BrowserDialog
      eyebrow="Navegador SofLIA"
      title={meta.label}
      description={meta.description}
      icon={meta.icon}
      onClose={props.onClose}
      closeLabel="Cerrar herramientas del navegador"
    >
      <BrowserTabs active={props.tab} onChange={props.onTabChange} />
      <div role="tabpanel" aria-label={meta.label}>
        {props.tab === 'history' && <HistoryPanel onClose={props.onClose} />}
        {props.tab === 'credentials' && <CredentialsPanel onFillCredential={props.onFillCredential} />}
        {props.tab === 'extensions' && <ExtensionsPanel />}
        {props.tab === 'privacy' && <BrowserPrivacyPanel />}
      </div>
    </BrowserDialog>
  );
}

function BrowserTabs(props: { active: BrowserManagementTab; onChange: (tab: BrowserManagementTab) => void }) {
  return (
    <div className="mb-4 grid grid-cols-4 gap-1 rounded-2xl border border-border bg-surface-2 p-1" role="tablist" aria-label="Administración del navegador">
      {(Object.keys(TAB_META) as BrowserManagementTab[]).map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={props.active === tab}
          tabIndex={props.active === tab ? 0 : -1}
          onClick={() => props.onChange(tab)}
          onKeyDown={(event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const tabs = Object.keys(TAB_META) as BrowserManagementTab[];
            const current = tabs.indexOf(tab);
            const nextIndex = event.key === 'Home' ? 0
              : event.key === 'End' ? tabs.length - 1
                : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
            const tablist = event.currentTarget.closest<HTMLElement>('[role="tablist"]');
            props.onChange(tabs[nextIndex]);
            requestAnimationFrame(() => {
              tablist?.querySelectorAll<HTMLElement>('[role="tab"]')[nextIndex]?.focus();
            });
          }}
          className={`flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-2 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20 ${props.active === tab ? 'bg-primary text-white shadow-lg dark:bg-accent dark:text-on-accent' : 'text-secondary hover:bg-accent/[0.06] hover:text-primary dark:hover:text-white'}`}
        >
          <span className="[&_svg]:h-4 [&_svg]:w-4 [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-[1.8] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round]" aria-hidden="true">{TAB_META[tab].icon}</span>
          <span className="hidden sm:inline">{TAB_META[tab].label}</span>
        </button>
      ))}
    </div>
  );
}

function HistoryPanel({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = useState<BrowserHistoryEntry[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (search: string) => {
    setLoading(true);
    const response = await integratedBrowserService.listHistory(search, 100);
    setLoading(false);
    if (!response.success) return setError(response.error || 'No se pudo cargar el historial.');
    setError(null);
    setEntries(response.history ?? []);
  }, []);

  useEffect(() => { void load(''); }, [load]);

  const clear = async () => {
    setBusy(true);
    const response = await integratedBrowserService.clearHistory();
    setBusy(false);
    if (consume(response, setError) && response.cleared) {
      setEntries([]);
      setConfirmClear(false);
    }
  };

  const reopen = async (url: string) => {
    const response = await integratedBrowserService.navigate(url);
    if (consume(response, setError)) onClose();
  };

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <SectionIntro label="Actividad reciente" detail={`${entries.length} visitas visibles`} />
        <button type="button" className="soflia-browser-button min-h-9 border-danger/20 bg-danger/[0.06] px-3 text-danger" onClick={() => setConfirmClear(true)} disabled={entries.length === 0}>
          Borrar historial
        </button>
      </div>
      <form className="relative mb-3" onSubmit={(event) => { event.preventDefault(); void load(query); }}>
        <label className="sr-only" htmlFor="browser-history-search">Buscar en historial</label>
        <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 fill-none stroke-secondary stroke-2" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
        <input id="browser-history-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por título o dirección" className="soflia-browser-field pl-10 pr-20" />
        <button className="absolute right-1.5 top-1/2 min-h-9 -translate-y-1/2 rounded-xl px-3 text-xs font-semibold text-primary transition hover:bg-accent/[0.08] dark:text-accent">Buscar</button>
      </form>
      {error && <ErrorNotice message={error} />}
      <div className="space-y-1.5">
        {loading ? <Empty title="Cargando historial" text="Recuperando tus visitas recientes…" /> : entries.length === 0 ? <Empty title="Todavía no hay visitas" text="Las páginas que abras aparecerán aquí." /> : entries.map((entry) => (
          <button key={entry.id} type="button" onClick={() => void reopen(entry.url)} className="group flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5 text-left transition hover:-translate-y-px hover:border-accent/15 hover:bg-accent/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-accent/15 bg-accent/[0.06] text-accent">
              <svg className="h-4 w-4 fill-none stroke-current stroke-[1.8]" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17L17 7M8 7h9v9" /></svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-primary dark:text-white/90">{entry.title || entry.url}</span>
              <span className="block truncate text-[11px] text-secondary">{entry.url}</span>
            </span>
            <span className="shrink-0 text-[10px] tabular-nums text-secondary">{formatVisit(entry.visitedAt)}</span>
          </button>
        ))}
      </div>
      {confirmClear && (
        <BrowserConfirmDialog
          title="Borrar todo el historial"
          description="Esta acción elimina las visitas guardadas en este equipo."
          detail="Tus cookies, sesiones, contraseñas y extensiones permanecerán intactas."
          confirmLabel="Borrar historial"
          busy={busy}
          onCancel={() => setConfirmClear(false)}
          onConfirm={() => void clear()}
        />
      )}
    </>
  );
}

function CredentialsPanel({ onFillCredential }: { onFillCredential: (id: string) => Promise<IntegratedBrowserDataResponse> }) {
  const [credentials, setCredentials] = useState<BrowserCredentialMetadata[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<BrowserCredentialMetadata | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await integratedBrowserService.listCredentials();
    if (!response.success) return setError(response.error || 'No se pudieron cargar las contraseñas.');
    setError(null);
    setCredentials(response.credentials ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const response = await integratedBrowserService.saveCredential({ username, password });
    setBusy(false);
    if (!consume(response, setError)) return;
    setPassword('');
    await load();
  };

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    const response = await integratedBrowserService.removeCredential(removing.id);
    setBusy(false);
    if (consume(response, setError) && response.removed) {
      setRemoving(null);
      await load();
    }
  };

  const fill = async (id: string) => {
    await onFillCredential(id);
  };

  return (
    <>
      <SectionIntro label="Bóveda local" detail="Cifrado por el sistema operativo; SofLIA nunca recibe el secreto." />
      <form className="mt-3 space-y-3 rounded-2xl border border-border bg-surface-2/70 p-3" onSubmit={(event) => void save(event)}>
        <Field label="Usuario o correo">
          <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" className="soflia-browser-field" required />
        </Field>
        <Field label="Contraseña">
          <input value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" type="password" className="soflia-browser-field" required />
        </Field>
        <button className="soflia-browser-button soflia-browser-button--primary w-full" disabled={busy}>{busy ? 'Guardando…' : 'Guardar credencial'}</button>
      </form>
      {error && <ErrorNotice message={error} />}
      <div className="mt-4 space-y-2">
        {credentials.length === 0 ? <Empty title="Sin credenciales guardadas" text="Guarda una para el sitio visible cuando la necesites." /> : credentials.map((credential) => (
          <div key={credential.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card/80 p-3 shadow-sm">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-accent/15 bg-accent/[0.06] text-accent">
              <svg className="h-4 w-4 fill-none stroke-current stroke-[1.8]" viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="15" r="4" /><path d="M11 12l8-8M15 8l2 2M17 6l2 2" /></svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-primary dark:text-white/90">{credential.username}</span>
              <span className="block truncate text-[11px] text-secondary">{credential.origin}</span>
            </span>
            <button type="button" className="soflia-browser-button soflia-browser-button--secondary min-h-9 px-3" onClick={() => void fill(credential.id)}>Rellenar</button>
            <IconAction label="Eliminar credencial" danger onClick={() => setRemoving(credential)}><path d="M4 7h16M9 7V4h6v3M8 11v6M12 11v6M16 11v6M6 7l1 14h10l1-14" /></IconAction>
          </div>
        ))}
      </div>
      {removing && (
        <BrowserConfirmDialog
          title="Eliminar credencial"
          description={`Se eliminará la credencial de ${removing.username}.`}
          detail={`Sitio protegido: ${removing.origin}. Esta acción no puede deshacerse.`}
          confirmLabel="Eliminar credencial"
          busy={busy}
          onCancel={() => setRemoving(null)}
          onConfirm={() => void remove()}
        />
      )}
    </>
  );
}

function ExtensionsPanel() {
  const [extensions, setExtensions] = useState<BrowserExtensionMetadata[]>([]);
  const [preview, setPreview] = useState<BrowserExtensionInstallPreview | null>(null);
  const [removing, setRemoving] = useState<BrowserExtensionMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await integratedBrowserService.listExtensions();
    if (!response.success) return setError(response.error || 'No se pudieron cargar las extensiones.');
    setError(null);
    setExtensions(response.extensions ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const inspect = async () => {
    setBusy(true);
    const response = await integratedBrowserService.installExtension();
    setBusy(false);
    if (!consume(response, setError) || response.canceled) return;
    if (response.preview) setPreview(response.preview);
  };

  const confirmInstall = async () => {
    if (!preview) return;
    setBusy(true);
    const response = await integratedBrowserService.confirmExtensionInstall(preview.token);
    setBusy(false);
    if (consume(response, setError)) {
      setPreview(null);
      await load();
    }
  };

  const toggle = async (extension: BrowserExtensionMetadata) => {
    setTogglingId(extension.installId);
    try {
      const nextEnabled = extension.status === 'error' ? true : !extension.enabled;
      if (consume(await integratedBrowserService.setExtensionEnabled(extension.installId, nextEnabled), setError)) await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo actualizar la extensión.');
    } finally {
      setTogglingId(null);
    }
  };

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    const response = await integratedBrowserService.removeExtension(removing.installId);
    setBusy(false);
    if (consume(response, setError) && response.removed) {
      setRemoving(null);
      await load();
    }
  };

  const declared = preview ? [...preview.permissions, ...preview.hostPermissions] : [];
  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <SectionIntro label="Complementos" detail="Solo carpetas Manifest V3 desempaquetadas y revisadas." />
        <button type="button" disabled={busy} className="soflia-browser-button soflia-browser-button--primary shrink-0" onClick={() => void inspect()}>{busy ? 'Revisando…' : 'Instalar carpeta'}</button>
      </div>
      <div className="mb-3 rounded-2xl border border-warning/20 bg-warning/[0.06] px-3 py-2.5 text-[11px] leading-relaxed text-secondary">
        Chrome Web Store y archivos CRX no son compatibles. Los permisos se muestran antes de instalar.
      </div>
      {error && <ErrorNotice message={error} />}
      <div className="space-y-2">
        {extensions.length === 0 ? <Empty title="Sin extensiones instaladas" text="Selecciona una carpeta compatible para comenzar." /> : extensions.map((extension) => {
          const declared = [...new Set([...extension.permissions, ...extension.hostPermissions])];
          const retrying = togglingId === extension.installId;
          return (
          <div key={extension.installId} className="rounded-2xl border border-border bg-card/80 p-3 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-accent/15 bg-accent/[0.06] text-accent">
                <svg className="h-4 w-4 fill-none stroke-current stroke-[1.8]" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3h5v5a2 2 0 104 0V3h4v7h-5a2 2 0 100 4h5v7h-7v-5a2 2 0 10-4 0v5H3v-7h5a2 2 0 100-4H3V3h5z" /></svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-primary dark:text-white/90">{extension.name} <span className="font-normal text-secondary">{extension.version}</span></span>
                <span className={`block text-[11px] ${extension.status === 'error' ? 'text-danger' : 'text-secondary'}`}>{extension.error || (extension.enabled ? 'Activa' : 'Deshabilitada')}</span>
              </span>
              <button type="button" disabled={retrying} className="soflia-browser-button soflia-browser-button--secondary min-h-9 px-3" onClick={() => void toggle(extension)}>{retrying ? 'Aplicando…' : extension.status === 'error' ? 'Reintentar' : extension.enabled ? 'Deshabilitar' : 'Habilitar'}</button>
              <IconAction label="Remover extensión" danger onClick={() => setRemoving(extension)}><path d="M4 7h16M9 7V4h6v3M8 11v6M12 11v6M16 11v6M6 7l1 14h10l1-14" /></IconAction>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border/70 pt-2">
              {declared.length === 0
                ? <span className="text-[10px] text-secondary">Sin permisos ni sitios adicionales.</span>
                : declared.map((permission) => <span key={permission} className="max-w-full truncate rounded-full border border-accent/15 bg-accent/[0.06] px-2 py-1 text-[10px] text-secondary" title={permission}>{permission}</span>)}
            </div>
          </div>
          );
        })}
      </div>
      {preview && (
        <BrowserConfirmDialog
          tone="primary"
          title={`Instalar ${preview.name}`}
          description={`Versión ${preview.version}. La extensión podrá ejecutar código dentro del navegador.`}
          detail={declared.length ? `Permisos y sitios declarados: ${declared.join(', ')}` : 'No declara permisos ni sitios adicionales.'}
          confirmLabel="Instalar extensión"
          busy={busy}
          onCancel={() => setPreview(null)}
          onConfirm={() => void confirmInstall()}
        />
      )}
      {removing && (
        <BrowserConfirmDialog
          title={`Remover ${removing.name}`}
          description="La extensión se descargará de la sesión y se eliminará su copia administrada."
          detail="Esta acción no afecta el historial, las contraseñas ni las cookies del navegador."
          confirmLabel="Remover extensión"
          busy={busy}
          onCancel={() => setRemoving(null)}
          onConfirm={() => void remove()}
        />
      )}
    </>
  );
}

function Field(props: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block font-[var(--font-system-label)] text-[9px] font-semibold uppercase tracking-[0.12em] text-secondary">{props.label}</span>{props.children}</label>;
}

function SectionIntro(props: { label: string; detail: string }) {
  return <div className="min-w-0"><h3 className="font-[var(--font-system-label)] text-[10px] font-semibold uppercase tracking-[0.12em] text-primary dark:text-white/85">{props.label}</h3><p className="mt-1 text-[11px] leading-relaxed text-secondary">{props.detail}</p></div>;
}

function IconAction(props: { label: string; danger?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={props.label} title={props.label} onClick={props.onClick} className={`soflia-browser-icon-button h-9 w-9 ${props.danger ? 'hover:border-danger/20 hover:bg-danger/[0.07] hover:text-danger' : ''}`}>
      <svg viewBox="0 0 24 24" aria-hidden="true">{props.children}</svg>
    </button>
  );
}

function consume(response: IntegratedBrowserDataResponse, setError: (value: string | null) => void): boolean {
  if (!response.success) {
    setError(response.error || 'No se pudo completar la operación.');
    return false;
  }
  setError(null);
  return true;
}

function ErrorNotice({ message }: { message: string }) {
  return <div role="alert" className="my-3 rounded-2xl border border-danger/15 bg-danger/[0.07] px-3 py-2.5 text-xs leading-relaxed text-danger">{message}</div>;
}

function Empty({ title, text }: { title: string; text: string }) {
  return <div className="grid min-h-32 place-items-center rounded-2xl border border-dashed border-border bg-surface-2/50 px-4 text-center"><div><p className="font-[var(--font-system-display)] text-lg text-primary dark:text-white/85">{title}</p><p className="mt-1 text-[11px] text-secondary">{text}</p></div></div>;
}

function formatVisit(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
}
