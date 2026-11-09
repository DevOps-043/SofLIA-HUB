import { useState } from 'react';
import { projectHubApi } from '../../services/project-hub-api';
import { safeWebUrl } from '../../services/project-web-url';
import { Button } from '../ui/Button';
import { ProjectGlyph } from './ProjectGlyph';
import { ProjectDialog } from './ProjectDialog';
import { ProjectEvidenceActions } from './ProjectEvidenceActions';
import { record, text, type DataRecord } from './dashboard-data';
import { useProjectCollection } from './useProjectCollection';
import { resourceRows } from './useProjectDashboard';
import { MoreButton } from './ManagementControls';

export function ProjectWebPages(props: { workspaceId: string; projectId: string; canWrite: boolean; canManage: boolean; onRefresh(): void; onOpenWeb?(url: string): void; onOpenBrowser?(): void }) {
  const [detail, setDetail] = useState<DataRecord | null>(null), [error, setError] = useState('');
  const list = useProjectCollection(`${props.workspaceId}/${props.projectId}/web`, cursor => projectHubApi.listEvidence(props.workspaceId, props.projectId, { cursor }), 'evidence_id');
  const rows = resourceRows(list.state.data, 'web');
  const refresh = () => { list.reload(); };
  const openDetail = async (row: DataRecord) => {
    setDetail(row); setError('');
    // Las colecciones anteriores pueden incluir varias páginas capturadas.
    if (row.evidence_type !== 'browser_collection') return;
    const result = await projectHubApi.getEvidence(props.workspaceId, props.projectId, text(row.evidence_id));
    if (result.success && result.data) setDetail(current => current?.evidence_id === row.evidence_id ? record(result.data) : current);
    else setError(result.error || 'No se pudo consultar la colección.');
  };
  const urlFor = (row: DataRecord) => safeWebUrl(text(record(row.metadata).url) || text(row.external_reference));
  return <section className="space-y-5" aria-label="Páginas del proyecto">
    <div className="project-resource-heading"><div><h2>Páginas web</h2><p>Las páginas que guardas desde el navegador de Soflia.</p></div><div className="project-resource-actions"><Button size="sm" variant="ghost" onClick={refresh}>Actualizar páginas</Button>{props.onOpenBrowser && <Button size="sm" onClick={props.onOpenBrowser}>Abrir navegador</Button>}</div></div>
    {list.state.loading && <p role="status" className="text-xs text-secondary">Cargando páginas…</p>}
    {list.state.error && <p role="alert" className="project-resource-notice">{list.state.error}<Button size="sm" onClick={list.reload}>Reintentar páginas</Button></p>}
    {!!rows.length && <div className="project-web-list">{rows.map(row => <article key={text(row.evidence_id)} className="project-web-row"><ProjectGlyph name="web" size={24} /><div><h3>{text(row.title, 'Página guardada')}</h3><p>{urlFor(row) || text(row.summary, 'Colección del navegador')}</p></div><Button size="sm" variant="ghost" onClick={() => void openDetail(row).catch(() => setError('No se pudo consultar la página.'))}>Ver detalle</Button><Button size="sm" variant="secondary" disabled={!props.onOpenWeb || !urlFor(row)} onClick={() => { const url = urlFor(row); if (url) props.onOpenWeb?.(url); }}>Abrir página</Button></article>)}</div>}
    {!rows.length && !list.state.loading && !list.state.error && <div className="project-resource-empty"><ProjectGlyph name="web" size={36} /><h3>Aún no hay páginas guardadas</h3><p>Abre el navegador de Soflia y usa Guardar en proyecto en la página que quieras conservar.</p></div>}
    {error && <p role="alert" className="project-resource-notice">{error}</p>}
    <MoreButton hasMore={list.hasMore} loading={list.moreLoading} onMore={() => void list.more()} />
    {detail && <ProjectDialog title={text(detail.title, 'Página guardada')} onClose={() => setDetail(null)}><p className="mb-4 text-sm text-secondary">{text(detail.summary)}</p>{(Array.isArray(detail.pm_project_evidence_items) ? detail.pm_project_evidence_items : [detail.metadata]).map((item, index) => { const row = record(item), url = safeWebUrl(text(row.source_url) || text(row.url)); return <div key={index} className="mb-4"><h3 className="text-sm font-semibold">{text(row.title)}</h3>{url && <Button size="sm" variant="ghost" disabled={!props.onOpenWeb} onClick={() => props.onOpenWeb?.(url)}>Abrir {text(row.title, 'página')}</Button>}<p className="whitespace-pre-wrap text-xs text-secondary">{text(row.content).slice(0, 20000)}</p></div>; })}<ProjectEvidenceActions workspaceId={props.workspaceId} projectId={props.projectId} row={detail} canWrite={props.canWrite} canManage={props.canManage} onRefresh={() => { setDetail(null); refresh(); }} /></ProjectDialog>}
  </section>;
}
