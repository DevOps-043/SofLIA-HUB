import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { BrowserCredentialGate } from './BrowserCredentialGate';
import { BrowserExtensionSiteAccess } from './BrowserExtensionSiteAccess';
import { BrowserExtensionCatalog } from './BrowserExtensionCatalog';
import {
  integratedBrowserService,
  type BrowserCredentialMetadata,
  type BrowserCredentialHealth,
  type BrowserDownloadRecord,
  type BrowserExtensionInstallPreview,
  type BrowserExtensionMetadata,
  type BrowserHistoryEntry,
  type IntegratedBrowserDataResponse,
  type BrowserBookmark,
  type BrowserAgentPolicyMode,
} from '../../services/integrated-browser-service';
import { BrowserConfirmDialog, BrowserDialog } from './BrowserDialog';
import { BrowserPrivacyPanel } from './BrowserPrivacyPanel';
import { BrowserHistorySettings } from './BrowserHistorySettings';
import { BrowserRuntimeSupportPanel } from './BrowserRuntimeSupportPanel';
import { BrowserSyncPanel } from './BrowserSyncPanel';
import { BrowserAgentAuditPanel } from './BrowserAgentAuditPanel';
import { BrowserSemanticMemoryPanel } from './BrowserSemanticMemoryPanel';
import { generateStrongPassword } from '../../services/password-generator';

export type BrowserManagementTab = 'downloads' | 'bookmarks' | 'history' | 'credentials' | 'agent' | 'extensions' | 'privacy' | 'support' | 'sync';

const TAB_META: Record<BrowserManagementTab, { label: string; description: string; icon: ReactNode }> = {
  downloads: {
    label: 'Descargas',
    description: 'Consulta progreso y controla archivos iniciados por las páginas.',
    icon: <svg viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5M4 21h16" /></svg>,
  },
  bookmarks: {
    label: 'Marcadores',
    description: 'Organiza, busca e intercambia tus sitios guardados.',
    icon: <svg viewBox="0 0 24 24"><path d="M6 4h12v17l-6-4-6 4z" /></svg>,
  },
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
  agent: {
    label: 'Agente',
    description: 'Decide cuándo SofLIA puede observar o actuar en cada sitio.',
    icon: <svg viewBox="0 0 24 24"><path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2zM18 16l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" /></svg>,
  },
  support: {
    label: 'Soporte',
    description: 'Versiones y protecciones del runtime sin rutas ni identificadores.',
    icon: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 11h1v5h1" /></svg>,
  },
  sync: {
    label: 'Sincronización', description: 'Registro y revocación de dispositivos de tu cuenta.',
    icon: <svg viewBox="0 0 24 24"><path d="M4 10a8 8 0 0114-5l2 2M20 3v4h-4M20 14A8 8 0 016 19l-2-2M4 21v-4h4" /></svg>,
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
        {props.tab === 'downloads' && <DownloadsPanel />}
        {props.tab === 'bookmarks' && <BookmarksPanel onClose={props.onClose} />}
        {props.tab === 'history' && <HistoryPanel onClose={props.onClose} />}
        {props.tab === 'credentials' && <CredentialsPanel onFillCredential={props.onFillCredential} />}
        {props.tab === 'agent' && <><AgentGovernancePanel />
          <p className="mt-3 text-xs text-secondary">En Orbe puedes decir «navegador siguiente pestaña», «navegador estado», «navegador pausa», «navegador detén» o «navegador toma el control». «Navegador reanuda» requiere confirmación en la ventana principal.</p>
          <BrowserAgentAuditPanel /><BrowserSemanticMemoryPanel /></>}
        {props.tab === 'extensions' && <ExtensionsPanel />}
        {props.tab === 'privacy' && <BrowserPrivacyPanel />}
        {props.tab === 'support' && <BrowserRuntimeSupportPanel />}
        {props.tab === 'sync' && <BrowserSyncPanel />}
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
          aria-label={TAB_META[tab].label}
          title={TAB_META[tab].label}
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
          <span className="min-w-0 truncate">{TAB_META[tab].label}</span>
        </button>
      ))}
    </div>
  );
}

function AgentGovernancePanel() {
  const [origin, setOrigin] = useState('');
  const [mode, setMode] = useState<BrowserAgentPolicyMode>('balanced');
  const [decision, setDecision] = useState<'ask' | 'allow-always' | 'block'>('ask');
  const [managed, setManaged] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await integratedBrowserService.getAgentPolicy();
    if (!response.success || !response.agentPolicy) return setError(response.error || 'No se pudo cargar la política del agente.');
    setOrigin(response.agentPolicy.origin);
    setMode(response.agentPolicy.mode);
    setDecision(response.agentPolicy.decision === 'allow-once' ? 'ask' : response.agentPolicy.decision);
    setManaged(response.agentPolicy.managed);
    setEnabled(response.agentPolicy.enabled !== false);
    setError(null);
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const response = await integratedBrowserService.setAgentPolicy({ origin, mode, decision });
    if (!consume(response, setError)) return;
    setNotice('Política de SofLIA actualizada para este sitio.');
    await load();
  };

  return <form className="space-y-4" onSubmit={(event) => void save(event)}>
    <SectionIntro label="Control por sitio" detail={origin || 'Abre un sitio web para configurar a SofLIA.'} />
    {!enabled && <p role="status" className="text-xs text-secondary">El gobierno avanzado del agente está desactivado en esta instalación.</p>}
    <div className="rounded-2xl border border-border bg-surface-2/70 p-4">
      <Field label="Modo">
        <select value={mode} disabled={managed || !enabled} onChange={(event) => setMode(event.target.value as BrowserAgentPolicyMode)} className="soflia-browser-field">
          <option value="balanced">Equilibrado: lectura local y confirmación antes de actuar</option>
          <option value="strict">Estricto: confirmar observación y acciones</option>
        </select>
      </Field>
      <div className="mt-3"><Field label="Decisión para este sitio">
        <select value={decision} disabled={managed || !enabled} onChange={(event) => setDecision(event.target.value as typeof decision)} className="soflia-browser-field">
          <option value="ask">Preguntar cuando sea necesario</option>
          <option value="allow-always">Permitir siempre</option>
          <option value="block">Bloquear a SofLIA</option>
        </select>
      </Field></div>
      <p className="mt-3 text-[11px] text-secondary">El agente no recibe la bóveda de contraseñas ni cookies. Una captura puede incluir información visible: revisa la página antes de autorizarla.</p>
      <button disabled={managed || !enabled || !origin} className="soflia-browser-button soflia-browser-button--primary mt-4 w-full">{managed ? 'Administrado por tu organización' : 'Guardar política'}</button>
    </div>
    {error && <ErrorNotice message={error} />}{notice && <p role="status" className="rounded-xl border border-accent/20 bg-accent/[0.06] px-3 py-2 text-xs">{notice}</p>}
  </form>;
}

function BookmarksPanel({ onClose }: { onClose: () => void }) {
  const loadRevision = useRef(0);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [bookmarks, setBookmarks] = useState<BrowserBookmark[]>([]);
  const [query, setQuery] = useState('');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [folder, setFolder] = useState('');
  const [tags, setTags] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [removing, setRemoving] = useState<BrowserBookmark | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (search = '') => {
    const revision = ++loadRevision.current;
    try {
      const response = await integratedBrowserService.listBookmarks(search);
      if (revision !== loadRevision.current) return;
      if (!response.success) return setError(response.error || 'No se pudieron cargar los marcadores.');
      setError(null);
      setBookmarks(response.bookmarks ?? []);
    } catch (failure) { if (revision === loadRevision.current) setError(failure instanceof Error ? failure.message : 'No se pudieron cargar los marcadores.'); }
  }, []);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) return load(); });
    return () => { active = false; loadRevision.current += 1; };
  }, [load]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    loadRevision.current += 1;
    try {
      const response = await integratedBrowserService.saveBookmark({
      id: editingId,
      title,
      url,
      folderId: folder.trim() || null,
      tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      });
      if (!consume(response, setError)) return;
      setTitle(''); setUrl(''); setFolder(''); setTags(''); setEditingId(undefined);
      setNotice('Marcador guardado.');
      await load(query);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo guardar el marcador.'); }
    finally { setBusy(false); }
  };

  const move = async (bookmark: BrowserBookmark, delta: number) => {
    setBusy(true);
    try {
      const response = await integratedBrowserService.saveBookmark({ ...bookmark, position: bookmark.position + delta });
      if (consume(response, setError)) await load(query);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo mover el marcador.'); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      const response = await integratedBrowserService.removeBookmark(removing.id);
      if (consume(response, setError) && response.removed) {
        setRemoving(null);
        await load(query);
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo eliminar el marcador.'); }
    finally { setBusy(false); }
  };

  const transfer = async (kind: 'import' | 'export') => {
    setBusy(true);
    setNotice(null);
    try {
      const response = kind === 'import'
      ? await integratedBrowserService.importBookmarksHtml()
      : await integratedBrowserService.exportBookmarksHtml();
      if (!consume(response, setError) || !response.bookmarkTransfer || response.bookmarkTransfer.cancelled) return;
      const summary = response.bookmarkTransfer;
      setNotice(kind === 'import'
        ? `Importación terminada: ${summary.imported ?? 0} nuevos, ${summary.updated ?? 0} actualizados y ${summary.skipped ?? 0} omitidos.${summary.invalid !== undefined ? ` De los omitidos, ${summary.invalid} inválidos y ${summary.duplicates ?? 0} duplicados.` : ''}`
        : `Se exportaron ${summary.exported ?? 0} marcadores.`);
      if (kind === 'import') await load(query);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo completar la transferencia.'); }
    finally { setBusy(false); }
  };

  const recover = async () => {
    if (busy) return;
    setBusy(true); setNotice(null); loadRevision.current += 1;
    try {
      const response = await integratedBrowserService.recoverBookmarks();
      if (!consume(response, setError) || !response.bookmarkRecovery || response.bookmarkRecovery.cancelled) return;
      setNotice(`Se recuperaron ${response.bookmarkRecovery.restored} marcadores del respaldo. Se conservaron las copias locales.`);
      await load(query);
    } catch { setError('No se pudo recuperar el respaldo de marcadores. Vuelve a intentarlo.'); }
    finally { setBusy(false); }
  };

  const open = async (target: string) => {
    const response = await integratedBrowserService.navigate(target);
    if (consume(response, setError)) onClose();
  };

  return <>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <SectionIntro label="Biblioteca local" detail={`${bookmarks.length} marcadores visibles`} />
      <button type="button" disabled={busy} title="Revisar el respaldo si falta el archivo principal o está dañado" className="soflia-browser-button min-h-9 px-3" onClick={() => void recover()}>Recuperar respaldo</button>
      <div className="flex gap-2">
        <button type="button" disabled={busy} title="Revisar conteos y conflictos antes de importar" className="soflia-browser-button min-h-9 px-3" onClick={() => void transfer('import')}>Importar HTML</button>
        <button type="button" disabled={busy || bookmarks.length === 0} className="soflia-browser-button min-h-9 px-3" onClick={() => void transfer('export')}>Exportar HTML</button>
      </div>
    </div>
    <form className="mb-3 grid gap-2 rounded-2xl border border-border bg-surface-2/70 p-3 sm:grid-cols-2" onSubmit={(event) => void save(event)}>
      <Field label="Título"><input required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} className="soflia-browser-field" /></Field>
      <Field label="Dirección"><input required type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://" className="soflia-browser-field" /></Field>
      <Field label="Carpeta"><input maxLength={100} value={folder} onChange={(event) => setFolder(event.target.value)} placeholder="Trabajo/Clientes" className="soflia-browser-field" /></Field>
      <Field label="Etiquetas"><input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="investigación, lectura" className="soflia-browser-field" /></Field>
      <button disabled={busy} className="soflia-browser-button soflia-browser-button--primary sm:col-span-2">{busy ? 'Procesando…' : 'Guardar marcador'}</button>
      {editingId && <button type="button" className="soflia-browser-button sm:col-span-2" onClick={() => { setEditingId(undefined); setTitle(''); setUrl(''); setFolder(''); setTags(''); }}>Cancelar edición</button>}
    </form>
    <form className="relative mb-3" onSubmit={(event) => { event.preventDefault(); void load(query); }}>
      <label className="sr-only" htmlFor="browser-bookmark-search">Buscar marcadores</label>
      <input id="browser-bookmark-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por título, dirección o etiqueta" className="soflia-browser-field pr-20" />
      <button className="absolute right-1.5 top-1/2 min-h-9 -translate-y-1/2 rounded-xl px-3 text-xs font-semibold text-primary hover:bg-accent/[0.08] dark:text-accent">Buscar</button>
    </form>
    {error && <ErrorNotice message={error} />}
    {notice && <p role="status" className="mb-3 rounded-xl border border-accent/20 bg-accent/[0.06] px-3 py-2 text-xs text-primary dark:text-white/85">{notice}</p>}
    <div className="space-y-2">
      {bookmarks.length === 0 ? <Empty title="Sin marcadores" text="Guarda un sitio o importa un archivo HTML compatible." /> : bookmarks.map((bookmark) => <div key={bookmark.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card/80 p-3">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => void open(bookmark.url)}>
          <span className="block truncate text-[13px] font-semibold text-primary dark:text-white/90">{bookmark.title}</span>
          <span className="block truncate text-[11px] text-secondary">{bookmark.folderId ? `${bookmark.folderId} · ` : ''}{bookmark.url}</span>
          {bookmark.tags.length > 0 && <span className="mt-1 block truncate text-[10px] text-accent">{bookmark.tags.join(' · ')}</span>}
        </button>
        <button type="button" disabled={busy} aria-label={`Editar ${bookmark.title}`} className="soflia-browser-button px-2" onClick={() => { setEditingId(bookmark.id); setTitle(bookmark.title); setUrl(bookmark.url); setFolder(bookmark.folderId ?? ''); setTags(bookmark.tags.join(', ')); }}>Editar</button>
        <button type="button" disabled={busy || Boolean(query) || bookmark.position === 0} aria-label={`Subir ${bookmark.title}`} className="soflia-browser-button px-2" onClick={() => void move(bookmark, -1)}>↑</button>
        <button type="button" disabled={busy || Boolean(query) || bookmark.position >= bookmarks.length - 1} aria-label={`Bajar ${bookmark.title}`} className="soflia-browser-button px-2" onClick={() => void move(bookmark, 1)}>↓</button>
        <IconAction label="Eliminar marcador" danger onClick={() => setRemoving(bookmark)}><path d="M4 7h16M9 7V4h6v3M8 11v6M12 11v6M16 11v6M6 7l1 14h10l1-14" /></IconAction>
      </div>)}
    </div>
    {removing && <BrowserConfirmDialog title="Eliminar marcador" description={`Se eliminará “${removing.title}”.`} detail="La página no se modifica." confirmLabel="Eliminar" busy={busy} onCancel={() => setRemoving(null)} onConfirm={() => void remove()} />}
  </>;
}

function DownloadsPanel() {
  const [downloads, setDownloads] = useState<BrowserDownloadRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await integratedBrowserService.listDownloads();
    if (!response.success) return setError(response.error || 'No se pudieron cargar las descargas.');
    setError(null);
    setDownloads(response.downloads ?? []);
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) return load(); });
    const unsubscribe = integratedBrowserService.subscribe({ onDownloadsChanged: setDownloads });
    return () => { active = false; unsubscribe(); };
  }, [load]);

  const act = async (operation: () => Promise<IntegratedBrowserDataResponse>) => {
    const response = await operation();
    if (!consume(response, setError)) return;
    await load();
  };

  return (
    <>
      <SectionIntro label="Archivos del perfil" detail="El destino se limita a Descargas y los nombres se sanean antes de escribir." />
      {error && <ErrorNotice message={error} />}
      <div className="mt-3 space-y-2">
        {downloads.length === 0 ? <Empty title="Sin descargas" text="Los archivos iniciados por una página aparecerán aquí." /> : downloads.map((download) => (
          <div key={download.id} className="rounded-2xl border border-border bg-card/80 p-3 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-accent/15 bg-accent/[0.06] text-accent"><svg className="h-4 w-4 fill-none stroke-current stroke-[1.8]" viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5M4 21h16" /></svg></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-primary dark:text-white/90">{download.filename}</span>
                <span className="block truncate text-[11px] text-secondary">{download.origin} · {downloadLabel(download)}</span>
              </span>
              {download.state === 'progressing' && <button className="soflia-browser-button min-h-9 px-3" onClick={() => void act(() => integratedBrowserService.cancelDownload(download.id))}>Cancelar</button>}
              {download.canResume && <button className="soflia-browser-button min-h-9 px-3" onClick={() => void act(() => integratedBrowserService.resumeDownload(download.id))}>Reanudar</button>}
              {(download.state === 'interrupted' || download.state === 'cancelled') && !download.canResume && <button className="soflia-browser-button min-h-9 px-3" onClick={() => void act(() => integratedBrowserService.retryDownload(download.id))}>Reintentar</button>}
              {download.state === 'completed' && <>
                <button className="soflia-browser-button soflia-browser-button--primary min-h-9 px-3" onClick={() => void act(() => integratedBrowserService.openDownload(download.id))}>Abrir</button>
                <IconAction label="Mostrar en carpeta" onClick={() => void act(() => integratedBrowserService.revealDownload(download.id))}><path d="M3 6h7l2 2h9v11H3z" /></IconAction>
              </>}
            </div>
            {download.state === 'progressing' && (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-label={`Progreso ${Math.round((download.progress ?? 0) * 100)}%`}>
                <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.round((download.progress ?? 0) * 100)}%` }} />
              </div>
            )}
            {download.error && <p className="mt-2 text-[11px] text-danger">{download.error}</p>}
          </div>
        ))}
      </div>
    </>
  );
}

function downloadLabel(download: BrowserDownloadRecord): string {
  if (download.state === 'completed') return 'Completada';
  if (download.state === 'cancelled') return 'Cancelada';
  if (download.state === 'interrupted') return 'Interrumpida';
  if (download.state === 'blocked') return 'Bloqueada';
  if (download.state === 'progressing') {
    const percent = download.progress === null ? 'tamaño desconocido' : `${Math.round(download.progress * 100)}%`;
    return `Descargando, ${percent}`;
  }
  return download.state === 'paused' ? 'En pausa' : 'Pendiente';
}

function HistoryPanel({ onClose }: { onClose: () => void }) {
  const loadRevision = useRef(0);
  const [settingsRevision, setSettingsRevision] = useState(0);
  const [entries, setEntries] = useState<BrowserHistoryEntry[]>([]);
  const [query, setQuery] = useState('');
  const [domain, setDomain] = useState('');
  const [range, setRange] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [filters, setFilters] = useState({ query: '', domain: '', range: 'all' as typeof range });
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (offset = 0) => {
    const revision = ++loadRevision.current;
    setLoading(true);
    try {
      const response = await integratedBrowserService.listHistory(filters.query, 100, {
        offset,
        domain: filters.domain.trim() || undefined,
        from: historyRangeStart(filters.range),
      });
      if (revision !== loadRevision.current) return;
      if (!response.success) return setError(response.error || 'No se pudo cargar el historial.');
      setError(null);
      const next = response.history ?? [];
      setHasMore(next.length === 100);
      setEntries((current) => offset > 0 ? [...current, ...next] : next);
    } catch (failure) { if (revision === loadRevision.current) setError(failure instanceof Error ? failure.message : 'No se pudo cargar el historial.'); }
    finally { if (revision === loadRevision.current) setLoading(false); }
  }, [filters]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) return load(); });
    return () => { active = false; loadRevision.current += 1; };
  }, [load]);

  const clear = async () => {
    setBusy(true);
    loadRevision.current += 1;
    try {
      const response = await integratedBrowserService.clearHistory();
      if (consume(response, setError) && response.cleared) {
        setEntries([]); setHasMore(false);
        setSettingsRevision((revision) => revision + 1);
        setConfirmClear(false);
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo borrar el historial.'); }
    finally { setBusy(false); setLoading(false); }
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
      <form className="mb-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]" onSubmit={(event) => { event.preventDefault(); setFilters({ query, domain, range }); }}>
        <label className="sr-only" htmlFor="browser-history-search">Buscar en historial</label>
        <input id="browser-history-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Título o dirección" className="soflia-browser-field sm:col-span-3" />
        <label className="sr-only" htmlFor="browser-history-domain">Filtrar dominio</label>
        <input id="browser-history-domain" value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="Dominio" className="soflia-browser-field" />
        <label className="sr-only" htmlFor="browser-history-range">Filtrar fecha</label>
        <select id="browser-history-range" value={range} onChange={(event) => setRange(event.target.value as typeof range)} className="soflia-browser-field">
          <option value="all">Todo</option><option value="today">Hoy</option><option value="week">7 días</option><option value="month">30 días</option>
        </select>
        <button className="soflia-browser-button min-h-10 px-3">Buscar</button>
      </form>
      <BrowserHistorySettings key={settingsRevision} onChanged={() => void load()} onClose={onClose} />
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
      {hasMore && <button type="button" disabled={loading} className="soflia-browser-button mt-3 w-full" onClick={() => void load(entries.length)}>{loading ? 'Cargando…' : 'Cargar más'}</button>}
      {confirmClear && (
        <BrowserConfirmDialog
          title="Borrar todo el historial"
          description="Esta acción elimina las visitas guardadas en este equipo."
          detail="Se retiran también las copias locales anteriores del historial, incluidas las de recuperación. Tus cookies, sesiones, contraseñas y extensiones permanecerán intactas."
          confirmLabel="Borrar historial"
          busy={busy}
          onCancel={() => setConfirmClear(false)}
          onConfirm={() => void clear()}
        />
      )}
    </>
  );
}

function historyRangeStart(range: 'all' | 'today' | 'week' | 'month'): string | undefined {
  if (range === 'all') return undefined;
  const start = new Date();
  if (range === 'today') start.setHours(0, 0, 0, 0);
  else start.setDate(start.getDate() - (range === 'week' ? 7 : 30));
  return start.toISOString();
}

function CredentialsPanel(props: { onFillCredential: (id: string) => Promise<IntegratedBrowserDataResponse> }) {
  return <>
    <p className="text-sm text-gray-600 dark:text-white/70">Passkeys: usa la opción del sitio para acceder con Windows Hello o una llave compatible. El proveedor conserva la clave privada; no se guarda en esta bóveda ni se sincroniza con Pulse Hub. La selección de cuentas requiere control humano en el perfil autenticado. No se garantiza autofill condicional ni disponibilidad en todos los sistemas.</p>
    <BrowserCredentialGate><UnlockedCredentialsPanel {...props} /></BrowserCredentialGate>
  </>;
}

function UnlockedCredentialsPanel({ onFillCredential }: { onFillCredential: (id: string) => Promise<IntegratedBrowserDataResponse> }) {
  const [credentials, setCredentials] = useState<BrowserCredentialMetadata[]>([]);
  const [autosave, setAutosave] = useState(false);
  const [health, setHealth] = useState<Map<string, BrowserCredentialHealth>>(new Map());
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [origin, setOrigin] = useState<string | null>(null);
  const [editing, setEditing] = useState<BrowserCredentialMetadata | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<BrowserCredentialMetadata | null>(null);
  const [busy, setBusy] = useState(false);
  const operationPending = useRef(false);
  const lifetime = useRef(0);
  const requestSequence = useRef(0);

  const load = useCallback(async () => {
    const generation = lifetime.current;
    const request = ++requestSequence.current;
    const current = () => generation === lifetime.current && request === requestSequence.current;
    try {
      const response = await integratedBrowserService.listCredentials();
      if (!current()) return;
      if (!response.success || !response.credentialOrigin || !Array.isArray(response.credentials)) {
        setOrigin(null); setCredentials([]);
        setError(response.error || 'No se pudo determinar el sitio. Vuelve a abrir el gestor.');
        return;
      }
      setError(null); setOrigin(response.credentialOrigin); setCredentials(response.credentials);
      setAutosave(response.credentialAutosaveEnabled === true);
      setHealth(new Map());
      try {
        const healthResponse = await integratedBrowserService.analyzeCredentialHealth();
        if (current() && healthResponse.success) setHealth(new Map((healthResponse.credentialHealth ?? []).map((entry) => [entry.id, entry])));
      } catch { /* La biblioteca sigue disponible si falla el análisis opcional. */ }
    } catch {
      if (current()) { setOrigin(null); setCredentials([]); setError('No se pudieron cargar las contraseñas. Vuelve a intentarlo.'); }
    } finally { if (current()) setLoading(false); }
  }, []);
  useEffect(() => {
    const generation = ++lifetime.current;
    void Promise.resolve().then(() => { if (generation === lifetime.current) return load(); });
    return () => { lifetime.current = generation + 1; };
  }, [load]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!origin || operationPending.current) return;
    operationPending.current = true;
    const generation = lifetime.current;
    setBusy(true); setNotice(null); setError(null);
    try {
      const response = await integratedBrowserService.saveCredential({
        ...(editing ? { id: editing.id } : {}), username, password, expectedOrigin: origin,
      });
      if (generation !== lifetime.current) return;
      if (!consume(response, setError)) return;
      if (response.canceled) { setNotice('Actualización cancelada. La contraseña guardada se conserva.'); return; }
      if (!response.credential) { setError('No se confirmó el guardado. Revisa la biblioteca antes de reintentar.'); return; }
      setNotice('Credencial guardada.'); setEditing(null); setUsername(''); setPassword('');
      await load();
    } catch { if (generation === lifetime.current) setError('No se pudo guardar la credencial. Vuelve a intentarlo.'); }
    finally {
      operationPending.current = false;
      if (generation === lifetime.current) { setPassword(''); setBusy(false); }
    }
  };

  const remove = async () => {
    if (!removing || operationPending.current) return;
    operationPending.current = true;
    const generation = lifetime.current;
    setBusy(true);
    try {
      const response = await integratedBrowserService.removeCredential(removing.id);
      if (generation !== lifetime.current) return;
      if (consume(response, setError) && response.removed) {
        if (editing?.id === removing.id) { setEditing(null); setUsername(''); setPassword(''); }
        setRemoving(null); await load();
      }
    } catch { if (generation === lifetime.current) setError('No se pudo eliminar la credencial. Vuelve a intentarlo.'); }
    finally { operationPending.current = false; if (generation === lifetime.current) setBusy(false); }
  };

  const fill = async (id: string) => {
    if (operationPending.current) return;
    operationPending.current = true;
    const generation = lifetime.current;
    setBusy(true); setPassword('');
    try {
      const response = await onFillCredential(id);
      if (generation === lifetime.current) consume(response, setError);
    } catch { if (generation === lifetime.current) setError('No se pudo rellenar la credencial. Vuelve a intentarlo.'); }
    finally { operationPending.current = false; if (generation === lifetime.current) setBusy(false); }
  };

  const transfer = async (kind: 'import' | 'export') => {
    if (operationPending.current) return;
    operationPending.current = true;
    const generation = lifetime.current;
    setBusy(true); setError(null); setNotice(null);
    try {
      const response = kind === 'import'
        ? await integratedBrowserService.importCredentials()
        : await integratedBrowserService.exportCredentials();
      if (generation !== lifetime.current) return;
      if (!consume(response, setError)) return;
      if (response.cancelled) return;
      if (kind === 'import') {
        setNotice(`Importación completada: ${response.imported ?? 0} nuevas, ${response.updated ?? 0} actualizadas.`);
        await load();
      } else setNotice(`Exportación completada: ${response.exported ?? 0} credenciales.`);
    } catch { if (generation === lifetime.current) setError('No se pudo completar la transferencia. Vuelve a intentarlo.'); }
    finally { operationPending.current = false; if (generation === lifetime.current) setBusy(false); }
  };

  const toggleAutosave = async () => {
    if (operationPending.current) return;
    operationPending.current = true;
    const generation = lifetime.current;
    setBusy(true); setError(null);
    try {
      const response = await integratedBrowserService.setCredentialAutosave(!autosave);
      if (generation !== lifetime.current || !consume(response, setError)) return;
      setAutosave(response.credentialAutosaveEnabled === true);
    } catch { if (generation === lifetime.current) setError('No se pudo cambiar el guardado sugerido. Vuelve a intentarlo.'); }
    finally { operationPending.current = false; if (generation === lifetime.current) setBusy(false); }
  };

  const recoverVault = async () => {
    if (operationPending.current) return;
    operationPending.current = true;
    const generation = lifetime.current;
    ++requestSequence.current; setBusy(true); setError(null); setNotice(null); setPassword('');
    try {
      const response = await integratedBrowserService.recoverCredentials();
      if (generation !== lifetime.current || !consume(response, setError)) return;
      if (!response.credentialRecovery || response.credentialRecovery.cancelled) return;
      setEditing(null); setUsername(''); setAutosave(false);
      setNotice(`Se restauraron ${response.credentialRecovery.restored} credenciales. Verifica que sigan vigentes. El guardado sugerido permanece desactivado.`);
      await load();
    } catch { if (generation === lifetime.current) setError('No se pudo recuperar la bóveda. Vuelve a intentarlo.'); }
    finally { operationPending.current = false; if (generation === lifetime.current) setBusy(false); }
  };

  return (
    <>
      <SectionIntro label="Bóveda local" detail="Sitios, usuarios y contraseñas se guardan cifrados, con la clave protegida por el sistema operativo. No se sincronizan ni se devuelven al chat." />
      {origin && <p className="mt-2 break-all text-xs text-secondary">Sitio de la credencial: {origin}</p>}
      <label className="mt-3 flex items-start gap-2 text-xs text-secondary">
        <input type="checkbox" checked={autosave} disabled={busy || loading || !origin} onChange={() => void toggleAutosave()} />
        <span>Sugerir guardar al enviar un formulario<span className="mt-1 block text-[11px]">Requiere confirmación. Sólo formularios compatibles del sitio principal; no funciona mientras el agente controla la pestaña. Si no aparece, usa el guardado manual.</span></span>
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="soflia-browser-button soflia-browser-button--secondary min-h-9 px-3" disabled={busy} onClick={() => void transfer('import')}>Importar…</button>
        <button type="button" className="soflia-browser-button min-h-9 px-3" disabled={busy} onClick={() => void transfer('export')}>Exportar…</button>
        <button type="button" className="soflia-browser-button min-h-9 px-3" disabled={busy || loading} onClick={() => void recoverVault()}>Restaurar bóveda desde respaldo</button>
      </div>
      {editing && <p className="mt-2 text-xs text-secondary">Actualizando {editing.username}. Escribe una nueva contraseña; la anterior permanece oculta.</p>}
      <form className="mt-3 space-y-3 rounded-2xl border border-border bg-surface-2/70 p-3" onSubmit={(event) => void save(event)}>
        <Field label="Usuario o correo">
          <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" className="soflia-browser-field" maxLength={320} disabled={busy || !origin} required />
        </Field>
        <Field label="Contraseña">
          <div className="flex gap-2">
            <input value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" type="password" className="soflia-browser-field min-w-0 flex-1" maxLength={4096} disabled={busy || !origin} required />
            <button type="button" className="soflia-browser-button shrink-0 px-3" disabled={busy || !origin} onClick={() => setPassword(generateStrongPassword())}>Generar</button>
          </div>
        </Field>
        <button className="soflia-browser-button soflia-browser-button--primary w-full" disabled={busy || !origin}>{busy ? 'Procesando…' : editing ? 'Actualizar contraseña' : 'Guardar credencial'}</button>
        {editing && <button type="button" className="soflia-browser-button w-full" disabled={busy} onClick={() => { setEditing(null); setUsername(''); setPassword(''); setNotice(null); }}>Cancelar edición</button>}
      </form>
      {error && <ErrorNotice message={error} />}
      {notice && <p role="status" className="mt-3 text-xs text-secondary">{notice}</p>}
      {!origin && !loading && <button type="button" className="soflia-browser-button mt-2" onClick={() => void load()}>Reintentar carga</button>}
      <div className="mt-4 space-y-2">
        {loading ? <p role="status" className="text-xs text-secondary">Cargando contraseñas…</p> : credentials.length === 0 ? <Empty title="Sin credenciales guardadas" text="Guarda una para el sitio visible cuando la necesites." /> : credentials.map((credential) => (
          <div key={credential.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card/80 p-3 shadow-sm">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-accent/15 bg-accent/[0.06] text-accent">
              <svg className="h-4 w-4 fill-none stroke-current stroke-[1.8]" viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="15" r="4" /><path d="M11 12l8-8M15 8l2 2M17 6l2 2" /></svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-primary dark:text-white/90">{credential.username}</span>
              <span className="block truncate text-[11px] text-secondary">{credential.origin}</span>
              {health.get(credential.id)?.reasons.length ? <span className="mt-1 block text-[10px] text-warning" title={health.get(credential.id)?.reasons.join(' ')}>{health.get(credential.id)?.reused ? 'Contraseña reutilizada' : 'Contraseña débil'}</span> : null}
            </span>
            <button type="button" disabled={busy} className="soflia-browser-button soflia-browser-button--secondary min-h-9 px-3" onClick={() => void fill(credential.id)}>Rellenar</button>
            <button type="button" disabled={busy} aria-label={`Actualizar contraseña de ${credential.username}`} className="soflia-browser-button min-h-9 px-3" onClick={() => { setEditing(credential); setUsername(credential.username); setPassword(''); setNotice(null); setError(null); }}>Actualizar</button>
            <IconAction label="Eliminar credencial" danger onClick={() => { if (!operationPending.current) setRemoving(credential); }}><path d="M4 7h16M9 7V4h6v3M8 11v6M12 11v6M16 11v6M6 7l1 14h10l1-14" /></IconAction>
          </div>
        ))}
      </div>
      {removing && (
        <BrowserConfirmDialog
          title="Eliminar credencial"
          description={`Se eliminará la credencial de ${removing.username}.`}
          detail={`Sitio protegido: ${removing.origin}. También se eliminarán completas las copias cifradas de recuperación de bóvedas dañadas de este perfil. Esta acción no puede deshacerse.`}
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
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

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
        Chrome Web Store y archivos CRX no son compatibles. Los permisos se muestran antes de instalar. Solo disponibles en el perfil autenticado, sin acceso a archivos locales ni sesiones privadas o de invitado. Puedes restringir sitios en extensiones compatibles después de deshabilitarlas y cerrar las páginas.
      </div>
      {error && <ErrorNotice message={error} />}
      <div className="space-y-2">
        <BrowserExtensionCatalog extensions={extensions} onPreview={setPreview} />
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
            <BrowserExtensionSiteAccess extension={extension} onApplied={load} />
          </div>
          );
        })}
      </div>
      {preview && (
        <BrowserConfirmDialog
          tone="primary"
          title={`${preview.updateName ? 'Actualizar' : 'Instalar'} ${preview.name}`}
          description={`Versión ${preview.version}. ${preview.catalogName ? 'Fuente: ' + preview.catalogName + '. ' : ''}${preview.updateName ? 'Sustituirá la copia anterior y conservará restricciones por sitio. ' : ''}La extensión podrá ejecutar código dentro del navegador.`}
          detail={declared.length ? `Permisos y sitios declarados: ${declared.join(', ')}` : 'No declara permisos ni sitios adicionales.'}
          confirmLabel={preview.updateName ? 'Actualizar extensión' : 'Instalar extensión'}
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
