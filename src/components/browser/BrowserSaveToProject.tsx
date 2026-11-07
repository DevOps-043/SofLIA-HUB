import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { projectHubApi, type ProjectHubProject } from '../../services/project-hub-api';
import { safeWebUrl } from '../../services/project-web-url';
import { ProjectDialog } from '../project-workspace/ProjectDialog';
import { Button } from '../ui/Button';
import { ProjectGlyph } from '../project-workspace/ProjectGlyph';
import type { ProjectBrowserTarget } from '../project-workspace/types';
import { saveProjectBrowserPage } from '../../services/project-browser-page';

export function BrowserSaveToProject(props: { title: string; url: string; projectTarget?: ProjectBrowserTarget }) {
  const auth = useAuth();
  const organizationId = auth.sofiaContext?.currentOrganization?.id;
  const scope = `${auth.user?.id}/${organizationId}/${props.projectTarget?.workspaceId || ''}/${props.projectTarget?.projectId || ''}`;
  return <ProjectPageSaveControl key={scope} {...props} organizationId={organizationId} />;
}
function ProjectPageSaveControl({ title, url, organizationId, projectTarget }: { title: string; url: string; organizationId?: string; projectTarget?: ProjectBrowserTarget }) {
  const [open, setOpen] = useState(false);
  const [savedProjectName, setSavedProjectName] = useState('');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [savedUrl, setSavedUrl] = useState<string | null>(null), [uncertain, setUncertain] = useState(false);
  const live = useRef(true), pending = useRef(false);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const safe = safeWebUrl(url);
  const inScope = !projectTarget || projectTarget.organizationId === organizationId;
  const saved = !!safe && savedUrl === safe && inScope;
  const label = saved ? `Página guardada en ${projectTarget?.name || savedProjectName}` : projectTarget ? `Guardar página en ${projectTarget.name}` : 'Guardar página en un proyecto';
  const save = async () => {
    if (!projectTarget || !inScope || !projectTarget.canWrite || !safe || pending.current || uncertain || savedUrl === safe) return;
    pending.current = true; setBusy(true); setMessage('');
    try {
      const result = await saveProjectBrowserPage(projectTarget.workspaceId, projectTarget.projectId, title, safe);
      if (!live.current) return;
      if (result.success) { setSavedUrl(safe); setMessage(''); }
      else {
        const unknown = !!(result.uncertain || result.recoveryRequired);
        setUncertain(unknown);
        setMessage(result.cancelled ? 'Guardado cancelado.' : (result.error || 'No se confirmó el guardado.') + (unknown ? ' Revisa las páginas del proyecto antes de repetir.' : ''));
      }
    } catch { if (live.current) { setUncertain(true); setMessage('No se confirmó el guardado. Revisa las páginas del proyecto antes de repetir.'); } }
    finally { if (live.current) { pending.current = false; setBusy(false); } }
  };
  return <>
    <button type="button" title={saved ? label : projectTarget && !projectTarget.canWrite ? `Sólo lectura en ${projectTarget.name}` : label} aria-label={label} aria-pressed={saved} disabled={!safe || !organizationId || !inScope || busy || uncertain || saved || (!!projectTarget && !projectTarget.canWrite)} className={`grid h-8 w-8 place-items-center rounded-lg transition-colors ${saved ? 'bg-accent/15 text-accent ring-1 ring-accent/30 disabled:opacity-100' : 'text-secondary hover:bg-accent/10 disabled:opacity-30'}`} onClick={() => { if (projectTarget) void save(); else setOpen(true); }}><ProjectGlyph name="folder" size={18} /></button>
    {message && <span role="status" title={message} className="max-w-48 truncate px-1 text-[10px] text-secondary">{message}</span>}
    {open && !projectTarget && organizationId && safe && <SavePageDialog organizationId={organizationId} title={title} url={safe} onClose={() => setOpen(false)} onSaved={name => { setSavedProjectName(name); setSavedUrl(safe); setMessage(''); setOpen(false); }} />}
  </>;
}
export function SavePageDialog({ organizationId, title, url, onClose, onSaved }: { organizationId: string; title: string; url: string; onClose(): void; onSaved?(projectName: string): void }) {
  const [workspaceId, setWorkspaceId] = useState(''), [projects, setProjects] = useState<ProjectHubProject[]>([]), [selected, setSelected] = useState(''), [cursor, setCursor] = useState<string | undefined>(), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [message, setMessage] = useState(''), [saved, setSaved] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const live = useRef(true), pending = useRef(false);
  const load = async (workspace: string, next?: string) => {
    setLoading(true); setMessage('');
    try {
      const result = await projectHubApi.listProjects(workspace, undefined, next);
      if (!live.current) return;
      if (!result.success || !result.data) throw new Error(result.error || 'No se pudieron consultar los proyectos.');
      const rows = result.data.filter(project => ['owner', 'admin', 'member'].includes(project.role ?? project.membership?.project_role ?? ''));
      setProjects(previous => next ? [...previous, ...rows] : rows); setCursor(result.meta?.next_cursor || undefined);
    } catch (error) { if (live.current) setMessage(error instanceof Error ? error.message : 'No se pudieron consultar los proyectos.'); }
    finally { if (live.current) setLoading(false); }
  };
  useEffect(() => {
    live.current = true;
    void projectHubApi.resolveOrganization(organizationId).then(result => {
      if (!live.current) return;
      if (!result.success || !result.data) throw new Error(result.error || 'Selecciona una organización para continuar.');
      setWorkspaceId(result.data.workspaceId); return load(result.data.workspaceId);
    }).catch(error => { if (live.current) { setMessage(error instanceof Error ? error.message : 'No se pudo comprobar la organización.'); setLoading(false); } });
    return () => { live.current = false; };
  }, [organizationId]);
  const save = async () => {
    if (!workspaceId || !selected || pending.current || saved || uncertain) return;
    pending.current = true; setBusy(true); setMessage('');
    try {
      const result = await saveProjectBrowserPage(workspaceId, selected, title, url);
      if (!live.current) return;
      if (result.success) { setSaved(true); if (onSaved) onSaved(projects.find(project => project.project_id === selected)?.project_name || 'el proyecto'); else onClose(); }
      else {
        const unknown = !!(result.uncertain || result.recoveryRequired);
        setUncertain(unknown);
        setMessage((result.cancelled ? 'Guardado cancelado.' : result.error || 'No se confirmó el guardado.') + (unknown ? ' Revisa las páginas del proyecto antes de repetir.' : ''));
      }
    } catch { if (live.current) { setUncertain(true); setMessage('No se confirmó el guardado. Revisa las páginas del proyecto antes de repetir.'); } }
    finally { if (live.current) { pending.current = false; setBusy(false); } }
  };
  return <ProjectDialog title="Guardar página en un proyecto" onClose={onClose}>
    <h3 className="text-sm font-semibold">{title || 'Página actual'}</h3><p className="mb-5 mt-2 break-all text-xs text-secondary">{url}</p>
    <p className="mb-3 text-xs text-secondary">Elige el proyecto de esta organización. Se guarda el enlace, sin cookies ni sesión.</p>
    <div className="project-drive-entries">{projects.map(project => <button key={project.project_id} type="button" aria-pressed={selected === project.project_id} disabled={busy || saved} onClick={() => setSelected(project.project_id)}><ProjectGlyph name="folder" /><span>{project.project_name}</span><span>{selected === project.project_id ? '✓' : ''}</span></button>)}</div>
    {loading && <p role="status" className="mt-3 text-xs text-secondary">Cargando proyectos…</p>}
    {!loading && !projects.length && !message && <p className="mt-3 text-xs text-secondary">{cursor ? 'No hay proyectos editables en esta página. Consulta Más proyectos.' : 'No hay proyectos editables disponibles en esta organización.'}</p>}
    {cursor && <Button size="sm" variant="ghost" disabled={loading || busy} onClick={() => void load(workspaceId, cursor)}>Más proyectos</Button>}
    {message && <p role="status" className="project-resource-notice mt-4">{message}</p>}
    <footer><Button size="sm" variant="ghost" onClick={onClose}>{saved ? 'Cerrar' : 'Cancelar'}</Button>{!saved && <Button size="sm" disabled={!selected || busy || loading || uncertain} loading={busy} onClick={() => void save()}>Guardar página</Button>}</footer>
  </ProjectDialog>;
}
