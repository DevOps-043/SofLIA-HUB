import { useEffect, useState } from 'react';
import { projectHubApi } from '../../services/project-hub-api';
import { safeWebUrl } from '../../services/project-web-url';
import { useProjectFileDownload } from '../project-hub/useProjectFileDownload';
import { Button } from '../ui/Button';
import { TextField } from '../ui/TextField';
import { record, text, type DataRecord } from './dashboard-data';
import { MoreButton } from './ManagementControls';
import { useProjectCollection } from './useProjectCollection';
import { useProjectStorage } from './useProjectStorage';
import { ProjectDrivePicker } from './ProjectDrivePicker';
import { ProjectFilePreview } from './ProjectFilePreview';
import { ProjectDialog } from './ProjectDialog';
import { ProjectEvidenceActions } from './ProjectEvidenceActions';
import { ProjectGlyph } from './ProjectGlyph';
import { resourceRows } from './useProjectDashboard';

interface Props { workspaceId: string; projectId: string; canWrite: boolean; canManage: boolean; onRefresh(): void; onOpenWeb?(url: string): void }
interface Entry { key: string; name: string; source: string; url?: string; localId?: string; evidence?: DataRecord; document?: DataRecord; size?: number }
export function ProjectFileCollection(props: Props) {
  const { workspaceId, projectId } = props;
  const target = { workspaceId, projectId };
  const [search, setSearch] = useState(''), [picker, setPicker] = useState(false), [detail, setDetail] = useState<Entry | null>(null), [local, setLocal] = useState<Entry | null>(null), [connected, setConnected] = useState<boolean | null>(null), [notice, setNotice] = useState('');
  const storage = useProjectStorage(workspaceId, projectId);
  const download = useProjectFileDownload(workspaceId, projectId);
  const documents = useProjectCollection(`${workspaceId}/${projectId}/documents`, cursor => projectHubApi.listDocuments({ ...target, cursor }), 'id');
  const evidence = useProjectCollection(`${workspaceId}/${projectId}/evidence`, cursor => projectHubApi.listEvidence(workspaceId, projectId, { cursor }), 'evidence_id');
  useEffect(() => { let active = true; void projectHubApi.cloudAccounts().then(result => { if (active) setConnected(!!result.data?.some(account => account.provider === 'google_drive' && account.connected)); }).catch(() => { if (active) setConnected(false); }); return () => { active = false; }; }, []);
  const refresh = () => { void storage.load(); documents.reload(); evidence.reload(); };
  const entries: Entry[] = [
    ...(storage.data?.files || []).map(file => ({ key: `storage:${file.id}`, name: file.name, source: storage.data?.location?.mode === 'google_drive' ? 'Google Drive' : storage.data?.location?.mode === 'onedrive' ? 'OneDrive' : 'En tu equipo', url: file.webUrl, localId: storage.data?.location?.mode === 'local' ? file.id : undefined, size: file.size })),
    ...(documents.state.data || []).map(row => ({ key: `doc:${text(row.id)}`, name: text(row.name, 'Archivo'), source: text(row.provider).startsWith('google') ? 'Google Drive' : 'Documento vinculado', url: text(row.external_url), document: row })),
    ...resourceRows(evidence.state.data, 'files').map(row => ({ key: `evidence:${text(row.evidence_id)}`, name: text(row.title, 'Archivo'), source: row.evidence_type === 'drive_file' ? 'Google Drive' : 'Archivo cargado', url: text(record(row.metadata).url) || text(row.external_reference), evidence: row })),
  ];
  const seen = new Set<string>();
  const filtered = entries.filter(entry => { const url = safeWebUrl(entry.url || ''); const id = url || entry.key; if (seen.has(id)) return false; seen.add(id); return entry.name.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')); });
  const preview = (entry: Entry) => {
    if (entry.localId) setLocal(entry);
    else { const url = safeWebUrl(entry.url || ''); if (url && props.onOpenWeb) props.onOpenWeb(url); else setDetail(entry); }
  };
  const unlink = async (entry: Entry) => {
    if (!entry.document || !props.canManage) return;
    const result = await projectHubApi.removeDocument({ ...target, documentId: text(entry.document.id), expectedUpdatedAt: text(entry.document.updated_at) || undefined });
    if (result.success) { setDetail(null); refresh(); } else setNotice(result.error || 'No se confirmó la desvinculación.');
  };
  return <section className="project-file-collection" aria-label="Archivos del proyecto">
    <div className="project-resource-heading"><div><h2>Archivos</h2><p>Todos los archivos de este proyecto, en un solo lugar.</p></div><div className="project-resource-actions">
      <Button size="sm" variant="ghost" onClick={refresh} disabled={storage.busy}>Actualizar archivos</Button>
      {props.canWrite && <><Button size="sm" variant="secondary" disabled={!connected} title={!connected ? 'Inicia sesión con Google desde Ajustes → Conexiones para continuar' : undefined} onClick={() => setPicker(true)}><img src={`${import.meta.env.BASE_URL}brands/google-drive.png`} width="16" height="16" alt="" /> Vincular Drive</Button><Button size="sm" disabled={storage.busy || storage.loading || !storage.data?.location || storage.data.location.mode === 'cloud'} onClick={() => void storage.upload()}>Añadir archivo</Button></>}
    </div></div>
    <div className="project-files-search"><ProjectGlyph name="files" size={17} /><TextField aria-label="Buscar archivos" placeholder="Buscar archivos…" value={search} onChange={event => setSearch(event.target.value)} /></div>
    {connected === false && props.canWrite && <p className="text-xs text-secondary">Inicia sesión con Google en Conexiones para vincular archivos de Drive.</p>}
    {[storage.message, documents.state.error, evidence.state.error, download.message, notice].filter(Boolean).map((message, index) => <p key={index} role="status" className="project-resource-notice">{message}</p>)}
    {storage.busy && <Button size="sm" variant="ghost" onClick={() => void storage.cancel()}>Cancelar operación</Button>}
    {download.busy && <Button size="sm" variant="ghost" onClick={() => void download.cancel()}>Cancelar descarga</Button>}
    {(storage.loading || documents.state.loading || evidence.state.loading) && <p role="status" className="text-xs text-secondary">Cargando archivos…</p>}
    <div className="project-file-grid">{filtered.map(entry => <article className="project-file-tile" key={entry.key}>
      <button type="button" className="project-file-open" aria-label={`Vista previa de ${entry.name}`} onClick={() => preview(entry)}><span className="project-file-cover"><ProjectGlyph name={entry.document?.doc_type === 'folder' ? 'folder' : 'files'} size={36} /><span>{entry.name.includes('.') ? entry.name.split('.').pop()?.toUpperCase().slice(0, 8) : entry.document?.doc_type === 'folder' ? 'CARPETA' : 'ARCHIVO'}</span></span><span className="project-file-name" title={entry.name}>{entry.name}</span><span className="project-file-origin">{entry.source}{entry.size ? ` · ${Math.ceil(entry.size / 1024)} KB` : ''}</span></button>
      <div className="project-file-tile-actions"><Button size="sm" variant="ghost" onClick={() => setDetail(entry)}>Ver detalle</Button>{entry.evidence?.evidence_type === 'upload' && record(entry.evidence.metadata).upload_state === 'ready' && <Button size="sm" variant="ghost" disabled={download.busy} onClick={() => void download.download(text(entry.evidence?.evidence_id))}>Guardar copia</Button>}</div>
    </article>)}</div>
    {!filtered.length && !storage.loading && !documents.state.loading && !evidence.state.loading && <div className="project-resource-empty"><ProjectGlyph name="folder" size={34} /><h3>{search ? 'No hay archivos con ese nombre' : 'Tu proyecto empieza aquí'}</h3><p>{search ? 'Prueba con otra búsqueda.' : 'Añade archivos de tu equipo o vincula los que ya tienes en Drive.'}</p></div>}
    {storage.data?.partial && <p className="text-xs text-secondary">La carpeta muestra sus primeros 200 archivos. Abre su ubicación para consultar el resto.</p>}
    <MoreButton hasMore={documents.hasMore || evidence.hasMore} loading={documents.moreLoading || evidence.moreLoading} onMore={() => { if (documents.hasMore) void documents.more(); if (evidence.hasMore) void evidence.more(); }} />
    {picker && <ProjectDrivePicker {...target} onClose={() => setPicker(false)} onSaved={() => { setPicker(false); refresh(); }} />}
    {local?.localId && <ProjectFilePreview {...target} fileId={local.localId} name={local.name} onClose={() => setLocal(null)} />}
    {detail && <ProjectDialog title={detail.name} onClose={() => setDetail(null)}><p className="text-sm text-secondary">{detail.source}</p><Button size="sm" className="mt-4" disabled={!detail.localId && (!props.onOpenWeb || !safeWebUrl(detail.url || ''))} onClick={() => { setDetail(null); preview(detail); }}>Abrir vista previa</Button>{detail.evidence && <ProjectEvidenceActions {...target} row={detail.evidence} canWrite={props.canWrite} canManage={props.canManage} onRefresh={() => { setDetail(null); refresh(); }} />}{detail.document && props.canManage && <div className="mt-5"><p className="mb-2 text-xs text-secondary">Desvincular quita la referencia del proyecto y conserva el original en su proveedor.</p><Button variant="ghost" size="sm" onClick={() => void unlink(detail).catch(() => setNotice('No se confirmó la desvinculación. Actualiza los archivos.'))}>Desvincular archivo</Button></div>}</ProjectDialog>}
  </section>;
}
