import { useCallback, useEffect, useRef, useState } from 'react';
import { projectHubApi } from '../../services/project-hub-api';
import type { ProjectCloudFolderListing, ProjectCloudProvider, ProjectCloudSelection } from '../../shared/project-creation';
import { Button } from '../ui/Button';

export function ProjectCloudFolderPicker({ provider, onSelect, onBack }: { provider: ProjectCloudProvider; onSelect: (folder: ProjectCloudSelection) => void; onBack: () => void }) {
  const [listing, setListing] = useState<ProjectCloudFolderListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [newFolder, setNewFolder] = useState<string | null>(null);
  const [creationUncertain, setCreationUncertain] = useState(false);
  const sequence = useRef(0);
  const load = useCallback(async (selectionId?: string, cursor?: string) => {
    const request = ++sequence.current; setLoading(true); setError('');
    try {
      const result = await projectHubApi.cloudFolders({ provider, selectionId, cursor });
      if (request !== sequence.current) return;
      if (!result.success || !result.data) { setError(result.error || 'No se pudo abrir esta carpeta. Comprueba la conexión con tu cuenta.'); return; }
      const data = result.data;
      setListing(previous => cursor && previous ? { ...data, folders: [...previous.folders, ...data.folders] } : data);
    } catch { if (request === sequence.current) setError('No se pudo consultar tu cuenta. Revisa la conexión y los permisos.'); }
    finally { if (request === sequence.current) setLoading(false); }
  }, [provider]);
  const invalidate = useCallback(() => { sequence.current++; }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => { window.clearTimeout(timer); invalidate(); }; }, [load, invalidate]);
  const createFolder = async () => {
    if (!listing || !newFolder?.trim() || creating || creationUncertain) return;
    setCreating(true); setError('');
    const request = ++sequence.current;
    try {
      const result = await projectHubApi.createCloudFolder({ provider, selectionId: listing.selectionId, operationId: crypto.randomUUID(), name: newFolder.trim() });
      if (request !== sequence.current) return;
      if (!result.success || !result.data) { setCreationUncertain(true); setError('No se pudo confirmar la creación. Actualiza las carpetas antes de repetir.'); return; }
      setNewFolder(null); await load(result.data.selectionId);
    } catch { if (request === sequence.current) { setCreationUncertain(true); setError('No se pudo confirmar la creación. Actualiza las carpetas antes de repetir.'); } }
    finally { setCreating(false); }
  };
  return <section aria-label="Carpetas de la cuenta vinculada">
    <Button type="button" variant="ghost" size="sm" disabled={creating} onClick={onBack}>← Volver al proyecto</Button>
    <h3 className="mt-4 text-lg font-semibold">Elegir carpeta en {provider === 'google_drive' ? 'Google Drive' : 'OneDrive'}</h3>
    <p className="mt-1 text-sm text-secondary">{listing?.accountEmail || 'Consultando tu cuenta vinculada…'}</p>
    <fieldset disabled={creating}>
    <nav aria-label="Ruta de la carpeta" className="mt-4 flex flex-wrap gap-1 text-xs">{listing?.breadcrumbs.map(folder => <Button key={folder.selectionId} type="button" size="sm" variant="ghost" disabled={loading} onClick={() => void load(folder.selectionId)}>{folder.name} /</Button>)}</nav>
    <div className="mt-3 flex justify-end"><Button type="button" variant="secondary" size="sm" disabled={!listing || loading || !!error} onClick={() => { setNewFolder(''); setCreationUncertain(false); }}>+ Nueva carpeta</Button></div>
    {newFolder !== null && <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={event => { event.preventDefault(); void createFolder(); }}><label className="min-w-0 flex-1 text-xs">Nombre de la carpeta<input className="mt-1 w-full rounded-lg border border-border bg-surface-2 p-2 text-sm" autoFocus value={newFolder} maxLength={100} required pattern={'[^<>:"/\\\\|?*]+'} onChange={event => setNewFolder(event.target.value)} /></label><Button type="submit" size="sm" loading={creating} disabled={!newFolder.trim() || creationUncertain}>Crear carpeta</Button><Button type="button" size="sm" variant="ghost" onClick={() => setNewFolder(null)}>Cancelar</Button></form>}
    {error && <p role="alert" className="mt-3 rounded-xl bg-danger/10 p-3 text-sm text-danger">{error} <button type="button" className="underline" onClick={() => void load(listing?.selectionId)}>Reintentar</button></p>}
    <div className="project-folder-list mt-3 rounded-2xl border border-border" aria-busy={loading}>{loading && !listing ? <p role="status" className="p-5 text-sm text-secondary">Cargando carpetas…</p> : listing?.folders.length ? listing.folders.map(folder => <button key={folder.selectionId} type="button" disabled={loading} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-surface-2" onClick={() => void load(folder.selectionId)}><span aria-hidden="true">▱</span><span className="min-w-0 flex-1 truncate">{folder.name}</span><span aria-hidden="true">›</span></button>) : <p className="p-5 text-sm text-secondary">No hay subcarpetas en esta página.</p>}</div>
    {listing?.nextCursor && <Button type="button" className="mt-3" variant="ghost" size="sm" disabled={loading} onClick={() => void load(listing.selectionId, listing.nextCursor)}>Cargar más carpetas</Button>}
    <p className="mt-4 text-xs text-secondary">Se creará una carpeta nueva para tu proyecto dentro de la ubicación elegida.</p>
    <div className="mt-4 flex justify-end"><Button type="button" disabled={!listing || loading || !!error} onClick={() => { if (listing) onSelect(listing); }}>Usar esta carpeta</Button></div>
    </fieldset>
  </section>;
}
