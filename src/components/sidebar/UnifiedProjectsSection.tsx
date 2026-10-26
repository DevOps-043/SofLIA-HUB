import { useCallback, useEffect, useRef, useState } from 'react';
import { projectHubApi, type ProjectHubProject } from '../../services/project-hub-api';
import type { ProjectOrganization } from '../../shared/project-creation';
import type { SidebarProps } from './types';
import { SidebarSectionLabel } from './SidebarSectionLabel';
import { CreateProjectModal } from '../project-creation/CreateProjectModal';

const AUTO_RETRY_DELAYS_MS = [300, 1_000, 3_000];
const RECOVERABLE_CODES = new Set(['UNAVAILABLE', 'TIMEOUT', 'NOT_AUTHENTICATED', 'SOFIA_SESSION_PENDING']);

export function UnifiedProjectsSection({ props }: { props: SidebarProps }) {
  // Remontar invalida también el diálogo al cambiar de actor u organización.
  return <OrganizationProjects key={`${props.userEmail || ''}/${props.currentOrgId || ''}`} props={props} />;
}
function OrganizationProjects({ props }: { props: SidebarProps }) {
  const [projects, setProjects] = useState<ProjectHubProject[]>([]);
  const [organization, setOrganization] = useState<ProjectOrganization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [autoRetry, setAutoRetry] = useState(false);
  const [retryRevision, setRetryRevision] = useState(0);
  const loadSequence = useRef(0);
  const retryCount = useRef(0);
  const currentOrgId = props.currentOrgId;
  const load = useCallback(async (retryAuthentication = false, automatic = false) => {
    if (!automatic) retryCount.current = 0;
    const sequence = ++loadSequence.current;
    setLoading(true); setError(null); setAutoRetry(false);
    if (!currentOrgId) { setProjects([]); setOrganization(null); setError('Selecciona una organización para ver sus proyectos.'); setLoading(false); return; }
    try {
      let status = await projectHubApi.status();
      if (sequence !== loadSequence.current) return;
      if (retryAuthentication && status.success && !status.data?.authenticated) {
        await projectHubApi.retryAuthentication();
        if (sequence !== loadSequence.current) return;
        status = await projectHubApi.status();
      }
      if (sequence !== loadSequence.current) return;
      if (!status.success || status.data?.configured === false || status.data?.enabled === false || !status.data?.authenticated) {
        setOrganization(null); setProjects([]);
        setError(status.error || status.data?.authError?.error || 'No se pudo conectar con los proyectos de esta organización.');
        setAutoRetry(retryCount.current < AUTO_RETRY_DELAYS_MS.length && RECOVERABLE_CODES.has(status.code || status.data?.authError?.code || ''));
        return;
      }
      const resolved = await projectHubApi.resolveOrganization(currentOrgId);
      if (sequence !== loadSequence.current) return;
      if (!resolved.success || !resolved.data) { setOrganization(null); setProjects([]); setError(resolved.error || 'No se pudo comprobar la organización del proyecto.'); setAutoRetry(retryCount.current < AUTO_RETRY_DELAYS_MS.length && RECOVERABLE_CODES.has(resolved.code || '')); return; }
      const scoped = resolved.data;
      setOrganization(scoped);
      const result = await projectHubApi.listProjects(scoped.workspaceId);
      if (sequence !== loadSequence.current) return;
      setProjects(result.success ? (result.data || []).filter(project => project.workspace_id === scoped.workspaceId) : []);
      setError(result.success ? null : result.error || 'No se pudieron cargar los proyectos.');
      setAutoRetry(!result.success && retryCount.current < AUTO_RETRY_DELAYS_MS.length && RECOVERABLE_CODES.has(result.code || ''));
    } catch { if (sequence === loadSequence.current) { setProjects([]); setOrganization(null); setError('No se pudieron cargar los proyectos. Reintenta la conexión.'); } }
    finally { if (sequence === loadSequence.current) { setLoading(false); setRetryRevision(value => value + 1); } }
  }, [currentOrgId]);
  const invalidate = useCallback(() => { loadSequence.current++; }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(true); }, 0);
    return () => { window.clearTimeout(timer); invalidate(); };
  }, [load, invalidate]);
  useEffect(() => {
    if (!autoRetry || retryCount.current >= AUTO_RETRY_DELAYS_MS.length) return;
    const timer = window.setTimeout(() => {
      retryCount.current++;
      void load(true, true);
    }, AUTO_RETRY_DELAYS_MS[retryCount.current]);
    return () => window.clearTimeout(timer);
  }, [autoRetry, retryRevision, load]);
  const created = (project: ProjectHubProject) => {
    if (!organization || project.workspace_id !== organization.workspaceId) return;
    setCreatorOpen(false);
    props.onOpenUnifiedProject?.(organization.workspaceId, project.project_id);
    void load();
  };
  const recovering = autoRetry;
  return <>
    {props.isOpen && <SidebarSectionLabel label="Proyectos" action={<div className="flex gap-1">
      <button disabled={loading || recovering} onClick={() => void load(true)} className="grid h-6 w-6 place-items-center rounded-lg hover:bg-surface-2 disabled:opacity-40" title="Actualizar proyectos" aria-label="Actualizar proyectos">↻</button>
      <button disabled={!organization || loading} onClick={() => setCreatorOpen(true)} className="grid h-6 w-6 place-items-center rounded-lg bg-primary text-card disabled:opacity-40 dark:bg-accent dark:text-on-accent" title="Crear proyecto" aria-label="Crear proyecto">+</button>
    </div>} />}
    {creatorOpen && organization && currentOrgId && <CreateProjectModal organizationId={currentOrgId} workspaceId={organization.workspaceId} onClose={() => setCreatorOpen(false)} onCreated={created} />}
    {props.isOpen && (loading || recovering) && <p role="status" className="px-3 py-2 text-[11px] text-secondary">Cargando proyectos…</p>}
    {props.isOpen && error && !loading && !recovering && <button onClick={() => void load(true)} className="mx-2 rounded-lg border border-warning/30 bg-warning/10 px-2 py-1.5 text-left text-[10px] text-primary">{error} Reintentar</button>}
    {projects.map(project => <button key={project.project_id} onClick={() => props.onOpenUnifiedProject?.(project.workspace_id, project.project_id)}
      className={`flex min-h-9 w-full items-center gap-2 rounded-xl px-2 text-left text-[12px] transition-colors ${props.activeUnifiedProjectId === project.project_id ? 'bg-primary/10 font-semibold text-primary dark:bg-accent/10 dark:text-accent' : 'text-secondary hover:bg-surface-2'}`} title={`${props.orgName || organization?.name} · ${project.project_key}`}>
      <span className="h-2 w-2 rounded-full bg-success" /><span className="min-w-0 flex-1 truncate">{project.project_name}</span><span className="text-[9px] tabular-nums opacity-60">{project.completion_percentage}%</span>
    </button>)}
    {props.isOpen && !loading && !error && projects.length === 0 && <p className="px-3 py-2 text-[11px] text-secondary">Aún no hay proyectos.</p>}
  </>;
}
