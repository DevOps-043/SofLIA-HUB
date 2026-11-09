import { useEffect, useRef, useState } from 'react';
import { projectHubApi } from '../../services/project-hub-api';
import type { ProjectCloudFileListing } from '../../shared/project-creation';
import { Button } from '../ui/Button';
import { ProjectDialog } from './ProjectDialog';
import { ProjectGlyph } from './ProjectGlyph';

export function ProjectDrivePicker({ workspaceId, projectId, onClose, onSaved }: { workspaceId: string; projectId: string; onClose(): void; onSaved(): void }) {
  const [listing, setListing] = useState<ProjectCloudFileListing | null>(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const live = useRef(true), generation = useRef(0);
  const load = async (selectionId?: string, cursor?: string) => {
    const id = ++generation.current; setLoading(true); setError(''); setSelected(null);
    try {
      const result = await projectHubApi.cloudFiles({ provider: 'google_drive', selectionId, cursor });
      if (!live.current || generation.current !== id) return;
      if (!result.success || !result.data) throw new Error(result.error || 'No se pudieron consultar los archivos.');
      const data = result.data;
      setListing(previous => cursor && previous ? { ...data, folders: [...previous.folders, ...data.folders], files: [...previous.files, ...data.files] } : data);
    } catch (failure) { if (live.current && generation.current === id) setError(failure instanceof Error ? failure.message : 'No se pudo acceder a Drive.'); }
    finally { if (live.current && generation.current === id) setLoading(false); }
  };
  useEffect(() => { const sequence = generation; live.current = true; const timer = window.setTimeout(() => void load(), 0); return () => { window.clearTimeout(timer); live.current = false; sequence.current++; }; }, []);
  const link = async () => {
    if (!selected || busy) return; setBusy(true); setError('');
    try {
      const result = await projectHubApi.linkCloudFile({ workspaceId, projectId, selectionId: selected });
      if (!live.current) return;
      if (result.success) onSaved();
      else if (!result.cancelled) setError(result.error || 'No se pudo vincular el archivo. Revisa el proyecto antes de repetir.');
    } catch { if (live.current) setError('No se confirmó el vínculo. Actualiza los archivos antes de repetir.'); }
    finally { if (live.current) setBusy(false); }
  };
  return <ProjectDialog title="Vincular desde Google Drive" onClose={onClose}>
    <p className="text-xs text-secondary">{listing?.accountEmail || 'Tu cuenta de Google conectada'} · El original permanece en Drive.</p>
    <nav className="project-drive-breadcrumbs" aria-label="Carpeta de Drive">{listing?.breadcrumbs.map(crumb => <button type="button" key={crumb.selectionId} disabled={loading || busy} onClick={() => void load(crumb.selectionId)}>{crumb.name}<span aria-hidden="true"> / </span></button>)}</nav>
    {error && <p role="alert" className="project-resource-notice">{error}<Button size="sm" variant="ghost" onClick={() => void load(listing?.selectionId)}>Reintentar Drive</Button></p>}
    <div className="project-drive-entries" aria-label="Archivos de Google Drive">
      {listing?.folders.map(folder => <button type="button" key={folder.selectionId} disabled={loading || busy} onClick={() => void load(folder.selectionId)}><ProjectGlyph name="folder" /><span>{folder.name}</span><span aria-hidden="true">›</span></button>)}
      {listing?.files.map(file => <button type="button" key={file.selectionId} disabled={loading || busy} aria-pressed={selected === file.selectionId} onClick={() => setSelected(file.selectionId)}><ProjectGlyph name="files" /><span>{file.name}</span><span aria-hidden="true">{selected === file.selectionId ? '✓' : ''}</span></button>)}
      {!loading && listing && !listing.files.length && !listing.folders.length && <p className="project-resource-empty">Esta carpeta está vacía.</p>}
    </div>
    {loading && <p role="status" className="project-resource-notice">Consultando Drive…</p>}
    {listing?.nextCursor && <Button size="sm" variant="ghost" disabled={loading || busy} onClick={() => void load(listing.selectionId, listing.nextCursor)}>Cargar más archivos de Drive</Button>}
    <footer><Button size="sm" variant="ghost" onClick={onClose}>Cancelar</Button><Button size="sm" disabled={!selected || loading || busy} onClick={() => void link()} loading={busy}>Vincular archivo</Button></footer>
  </ProjectDialog>;
}
