import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { projectHubApi, type ProjectHubProject } from '../../services/project-hub-api';
import { projectDirectoryName, type ProjectFolderSelection, type ProjectCloudProvider, type ProjectCloudAccount, type ProjectCloudSelection } from '../../shared/project-creation';
import { Button } from '../ui/Button';
import { TextField } from '../ui/TextField';
import { ProjectCloudFolderPicker } from './ProjectCloudFolderPicker';

interface Props {
  organizationId: string;
  workspaceId: string;
  onClose: () => void;
  onCreated: (project: ProjectHubProject) => void;
}
export function CreateProjectModal(props: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const live = useRef(false);
  const pending = useRef(false);
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'local' | ProjectCloudProvider>('local');
  const [parent, setParent] = useState<ProjectFolderSelection | null>(null);
  const [additional, setAdditional] = useState<ProjectFolderSelection[]>([]);
  const [picker, setPicker] = useState<ProjectCloudProvider | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [accounts, setAccounts] = useState<ProjectCloudAccount[]>([]);
  const [cloudParents, setCloudParents] = useState<Partial<Record<ProjectCloudProvider, ProjectCloudSelection>>>({});
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState('');
  const operation = useRef(crypto.randomUUID());
  const lastDraft = useRef('');
  useEffect(() => {
    live.current = true;
    void projectHubApi.cloudAccounts().then(result => { if (live.current) { setAccounts(result.data || []); setAccountsLoading(false); } }).catch(() => { if (live.current) setAccountsLoading(false); });
    const element = dialog.current;
    const previous = document.activeElement;
    if (element && !element.open) {
      if (element.showModal) element.showModal(); else element.setAttribute('open', '');
    }
    return () => { live.current = false; element?.close?.(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);
  const directoryName = projectDirectoryName(name || 'Mi proyecto');
  const destination = parent ? parent.path.replace(/[\\/]+$/, '') + (parent.path.includes('\\') ? '\\' : '/') + directoryName : '';
  const selectNative = async (kind: 'primary' | 'additional') => {
    setSelecting(true); setError('');
    try {
      const result = await projectHubApi.selectFolder();
      if (!live.current || result.cancelled) return;
      if (!result.success || !result.data) { setError(result.error || 'No se pudo seleccionar la carpeta.'); return; }
      const folder = result.data;
      if (kind === 'primary') setParent(folder);
      else if (!additional.some(item => item.path === folder.path)) setAdditional(current => [...current, folder]);
    } catch { if (live.current) setError('No se pudo abrir el selector de carpetas del sistema.'); }
    finally { if (live.current) setSelecting(false); }
  };
  const cloudAccount = accounts.find(account => account.provider === mode);
  const cloudParent = mode !== 'local' ? cloudParents[mode] : undefined;
  const providerName = mode === 'google_drive' ? 'Google Drive' : 'OneDrive';
  const ready = mode === 'local' ? !!parent : !!cloudAccount?.connected && !cloudAccount.needsAuthorization && !!cloudParent;
  const authorize = async () => {
    if (mode === 'local') return;
    setSelecting(true); setError('');
    try {
      const result = await projectHubApi.authorizeCloud({ provider: mode });
      if (!live.current) return;
      if (!result.success) { setError(result.error || 'No se autorizó el acceso a los archivos.'); return; }
      const current = await projectHubApi.cloudAccounts();
      if (live.current) setAccounts(current.data || []);
    } catch { if (live.current) setError('No se pudo autorizar la cuenta vinculada.'); }
    finally { if (live.current) setSelecting(false); }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !ready || selecting || pending.current || uncertain) return;
    pending.current = true; setBusy(true); setError('');
    try {
      const draft = { organizationId: props.organizationId, name: name.trim(), storage: { mode, parentSelectionId: mode === 'local' ? parent!.selectionId : cloudParent!.selectionId }, additionalSelectionIds: additional.map(item => item.selectionId) };
      const fingerprint = JSON.stringify(draft);
      if (lastDraft.current && lastDraft.current !== fingerprint) operation.current = crypto.randomUUID();
      lastDraft.current = fingerprint;
      const result = await projectHubApi.createConfigured({ operationId: operation.current, ...draft });
      if (!live.current) return;
      if (result.success && result.data && result.data.workspace_id === props.workspaceId) { props.onCreated(result.data); return; }
      const unknown = result.uncertain || result.recoveryRequired || result.success;
      setUncertain(Boolean(unknown));
      setError(unknown ? (result.error || 'No se pudo verificar la creación.') + ' Cierra este diálogo y actualiza los proyectos antes de repetir.' : result.error || 'No se pudo crear el proyecto.');
    } catch { if (live.current) { setUncertain(true); setError('No se pudo verificar el resultado. Cierra este diálogo y actualiza los proyectos antes de repetir.'); } }
    finally { pending.current = false; if (live.current) setBusy(false); }
  };
  return createPortal(<dialog ref={dialog} className="project-create-dialog" data-native-browser-overlay aria-labelledby="project-create-title" aria-describedby="project-create-description" onCancel={event => { event.preventDefault(); if (!busy && !selecting) { if (picker) setPicker(null); else props.onClose(); } }} onClick={event => { if (event.target === event.currentTarget && !busy && !selecting) props.onClose(); }}>
    <div className="project-create-surface">
      <header className="project-create-header">
        <div className="project-create-mark" aria-hidden="true"><StorageIcon mode="local" /></div>
        <div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-secondary">Proyectos</p><h2 id="project-create-title" className="mt-1 text-2xl font-semibold tracking-tight">Nuevo proyecto</h2><p id="project-create-description" className="mt-1 text-sm text-secondary">Dale un nombre y elige dónde trabajar.</p></div>
        <button type="button" disabled={busy || selecting} aria-label="Cerrar nuevo proyecto" className="project-create-close" onClick={props.onClose}>×</button>
      </header>
      <div className="project-create-body custom-scrollbar">
        {picker ? <ProjectCloudFolderPicker provider={picker} onSelect={folder => { setCloudParents(current => ({ ...current, [folder.provider]: folder })); setPicker(null); }} onBack={() => setPicker(null)} /> : <form id="create-project-form" onSubmit={event => void submit(event)}>
          <fieldset disabled={busy || uncertain || selecting} className="min-w-0 space-y-5">
            <TextField id="new-project-name" label="Nombre del proyecto" value={name} onChange={event => setName(event.target.value)} placeholder="Ej. Lanzamiento de producto" maxLength={255} required autoFocus autoComplete="off" />
            <div>
              <h3 className="text-sm font-semibold">Dónde guardar los archivos</h3>
              <p className="mt-1 text-xs leading-relaxed text-secondary">Elige una ubicación para este proyecto.</p>
              <div className="project-storage-options mt-3">
                {([{ id: 'local', title: 'En mi equipo', detail: 'Carpeta local' }, { id: 'google_drive', title: 'Google Drive', detail: 'Tu cuenta de Google' }, { id: 'onedrive', title: 'OneDrive', detail: 'Tu cuenta de Microsoft' }] as const).map(item => {
                  const unavailable = item.id !== 'local' && (accountsLoading || !accounts.find(account => account.provider === item.id)?.connected);
                  const detail = unavailable ? accountsLoading ? 'Comprobando sesión…' : 'Inicia sesión para continuar' : item.detail;
                  return <label key={item.id} className={`project-storage-option ${mode === item.id ? 'is-selected' : ''} ${unavailable ? 'is-disabled' : ''}`} title={unavailable ? 'Inicia sesión desde Ajustes > Conexiones' : undefined}><input type="radio" name="project-storage" value={item.id} disabled={unavailable} checked={mode === item.id} onChange={() => { setMode(item.id); setError(''); }} />{item.id === 'local' ? <StorageIcon mode="local" /> : <img className="h-6 w-6 shrink-0 object-contain" src={`${import.meta.env.BASE_URL}brands/${item.id === 'google_drive' ? 'google-drive.png' : 'onedrive.svg'}`} alt="" aria-hidden="true" />}<span className="min-w-0"><span className="block text-sm font-semibold">{item.title}</span><span className="mt-1 block text-xs text-secondary">{detail}</span></span></label>;
                })}
              </div>
              {mode === 'local' ? <div className="project-storage-detail mt-3">
                <div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0 flex-1"><p className="text-xs font-medium text-secondary">Carpeta principal</p><p className="mt-1 break-all text-sm">{parent?.path || 'Selecciona dónde crear el proyecto'}</p></div><Button type="button" variant="secondary" size="sm" onClick={() => void selectNative('primary')}>{parent ? 'Cambiar' : 'Elegir carpeta'}</Button></div>
                <p className="mt-3 text-xs leading-relaxed text-secondary">Se creará una carpeta nueva con el nombre del proyecto. Puedes elegir una carpeta de OneDrive o Google Drive sincronizada en este equipo.</p>
                {parent && <div className="mt-3 border-t border-border pt-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Ubicación final</p><p className="mt-1 break-all text-xs font-medium">{destination}</p></div>}
              </div> : <div className="project-storage-detail mt-3">
                {accountsLoading ? <p role="status" className="text-sm text-secondary">Consultando cuentas vinculadas…</p> : !cloudAccount?.connected ? <p className="text-sm text-secondary">Vincula tu cuenta de {mode === 'google_drive' ? 'Google' : 'Microsoft'} desde Ajustes &gt; Conexiones para guardar aquí.</p> : <><p className="text-xs text-secondary">Cuenta vinculada</p><p className="mt-1 break-all text-sm font-medium">{cloudAccount.email}</p>{cloudAccount.needsAuthorization ? <div className="mt-3"><p className="mb-3 text-xs text-secondary">Autoriza el acceso a archivos de OneDrive con esta misma cuenta.</p><Button type="button" size="sm" variant="secondary" onClick={() => void authorize()}>Autorizar OneDrive</Button></div> : <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="min-w-0 flex-1 text-sm">{cloudParent ? `${cloudParent.name} / ${directoryName}` : `Selecciona una carpeta de ${providerName}`}</p><Button type="button" variant="secondary" size="sm" onClick={() => setPicker(mode)}>{cloudParent ? 'Cambiar carpeta de nube' : 'Elegir carpeta de nube'}</Button></div>}<p className="mt-3 text-xs leading-relaxed text-secondary">Los archivos se guardarán directamente en tu {providerName}. Soflia no almacena una copia de tus archivos.</p></>}
                {mode === 'onedrive' && cloudAccount?.connected && !cloudAccount.needsAuthorization && <button type="button" className="mt-3 text-xs text-secondary underline underline-offset-2" onClick={() => void authorize()}>Revisar autorización de OneDrive</button>}
              </div>}
            </div>
            <section className="border-t border-border pt-5" aria-labelledby="additional-folders-title">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 id="additional-folders-title" className="text-sm font-semibold">Carpetas adicionales <span className="ml-1 text-xs font-normal text-secondary">Opcional</span></h3><p className="mt-1 text-xs text-secondary">Vincula otras carpetas de trabajo de este equipo.</p></div><Button type="button" variant="ghost" size="sm" disabled={additional.length >= 10} onClick={() => void selectNative('additional')}>+ Añadir carpeta</Button></div>
              {additional.length ? <ul className="mt-3 space-y-2">{additional.map(folder => <li key={folder.selectionId} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5"><StorageIcon mode="local" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{folder.name}</p><p className="mt-0.5 truncate text-xs text-secondary" title={folder.path}>{folder.path}</p></div><button type="button" aria-label={`Quitar ${folder.name}`} className="project-create-close" onClick={() => setAdditional(current => current.filter(item => item.selectionId !== folder.selectionId))}>×</button></li>)}</ul> : <div className="mt-3 rounded-xl border border-dashed border-border px-4 py-3 text-xs text-secondary">Aún no hay carpetas adicionales.</div>}
              <p className="mt-3 text-[11px] leading-relaxed text-secondary">Se vinculan a este proyecto en tu equipo. Sus archivos no se copian ni se suben automáticamente.</p>
            </section>
          </fieldset>
          {error && <p role="alert" className="mt-4 rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p>}
        </form>}
      </div>
      {!picker && <footer className="project-create-footer"><p className="min-w-0 flex-1 text-xs text-secondary">{selecting ? 'Esperando al selector o autorización…' : mode === 'local' ? 'Archivos en tu equipo' : `Archivos en tu ${providerName}`}</p><Button type="button" variant="ghost" disabled={busy || selecting} onClick={props.onClose}>{uncertain ? 'Cerrar' : 'Cancelar'}</Button><Button type="submit" form="create-project-form" loading={busy} disabled={!name.trim() || !ready || selecting || uncertain}>{busy ? 'Creando proyecto…' : 'Crear proyecto'}</Button></footer>}
    </div>
  </dialog>, document.body);
}

function StorageIcon({ mode }: { mode: 'local' | 'cloud' }) {
  return <svg aria-hidden="true" className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{mode === 'local' ? <path d="M3 7V6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /> : <path d="M7 18a5 5 0 1 1 .6-10A6 6 0 0 1 19 9.5 4.3 4.3 0 0 1 18 18H7Z" />}</svg>;
}
