import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { projectHubApi, type ProjectHubProject } from '../../services/project-hub-api';
import type { SidebarProps } from './types';
import { SidebarSectionLabel } from './SidebarSectionLabel';

interface ListedProject extends ProjectHubProject { workspaceName: string }

export function UnifiedProjectsSection({ props }: { props: SidebarProps }) {
  const [projects, setProjects] = useState<ListedProject[]>([]);
  const [workspaces, setWorkspaces] = useState<Array<{ id: string; name: string; role: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async (retryAuthentication = false) => {
    setLoading(true);
    setError(null);
    let status = await projectHubApi.status();
    if (retryAuthentication && status.success && !status.data?.authenticated) {
      await projectHubApi.retryAuthentication();
      status = await projectHubApi.status();
    }
    if (!status.success || status.data?.enabled === false || !status.data?.authenticated) {
      setError(status.error || status.data?.authError?.error || 'Project Hub no está conectado.');
      setLoading(false);
      return;
    }
    setWorkspaces(status.data.workspaces);
    setSelectedWorkspaceId((current) => current || status.data!.workspaces[0]?.id || '');
    const results = await Promise.all(status.data.workspaces.map(async (workspace) => ({ workspace, result: await projectHubApi.listProjects(workspace.id) })));
    setProjects(results.flatMap(({ workspace, result }) => (result.data || []).map((project) => ({ ...project, workspaceName: workspace.name }))));
    setError(results.find(({ result }) => !result.success)?.result.error || null);
    setLoading(false);
  }, []);

  useEffect(() => {
    // El estado de autenticacion se publica desde otro efecto. El segundo
    // intento resuelve la carrera normal del arranque sin obligar al usuario a
    // pulsar Reintentar.
    const firstTimer = window.setTimeout(() => { void load(true); }, 0);
    const recoveryTimer = window.setTimeout(() => { void load(true); }, 1_500);
    return () => { window.clearTimeout(firstTimer); window.clearTimeout(recoveryTimer); };
  }, [load]);

  const openCreator = () => {
    if (!workspaces.length) return setError('No hay un workspace disponible.');
    setSelectedWorkspaceId((current) => current || workspaces[0].id);
    setProjectName('');
    setCreatorOpen(true);
    setError(null);
  };

  const createProject = async (event: FormEvent) => {
    event.preventDefault();
    const name = projectName.trim();
    if (!name || !selectedWorkspaceId || creating) return;
    setCreating(true);
    setError(null);
    const result = await projectHubApi.createProject(selectedWorkspaceId, { name, priority: 'medium', tags: [] });
    setCreating(false);
    if (!result.success || !result.data) return setError(result.error || 'No se pudo crear el proyecto.');
    setCreatorOpen(false);
    setProjectName('');
    await load();
    props.onOpenUnifiedProject?.(selectedWorkspaceId, result.data.project_id);
  };

  return (
    <>
      {props.isOpen && <SidebarSectionLabel label="Proyectos" action={<div className="flex gap-1">
        <button onClick={() => void load(true)} className="grid h-6 w-6 place-items-center rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.06]" title="Actualizar proyectos">↻</button>
        <button onClick={openCreator} className="grid h-6 w-6 place-items-center rounded-lg bg-[#0A2540] text-white dark:bg-accent dark:text-[#071018]" title="Crear proyecto">+</button>
      </div>} />}
      {props.isOpen && creatorOpen && (
        <form onSubmit={(event) => void createProject(event)} className="mx-2 mb-2 space-y-2 rounded-xl border border-gray-200 bg-white p-2 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
          <label className="block text-[10px] font-semibold text-secondary dark:text-white/70">
            Nombre del proyecto
            <input
              autoFocus
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              maxLength={255}
              placeholder="Ej. Lanzamiento Q4"
              className="mt-1 h-8 w-full rounded-lg border border-gray-200 bg-white px-2 text-[11px] text-[#0A2540] outline-none focus:border-accent dark:border-white/10 dark:bg-[#0a0e14] dark:text-white"
            />
          </label>
          {workspaces.length > 1 && (
            <label className="block text-[10px] font-semibold text-secondary dark:text-white/70">
              Workspace
              <select
                value={selectedWorkspaceId}
                onChange={(event) => setSelectedWorkspaceId(event.target.value)}
                className="mt-1 h-8 w-full rounded-lg border border-gray-200 bg-white px-2 text-[11px] text-[#0A2540] outline-none dark:border-white/10 dark:bg-[#0a0e14] dark:text-white"
              >
                {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
              </select>
            </label>
          )}
          <div className="flex justify-end gap-1.5">
            <button type="button" onClick={() => setCreatorOpen(false)} className="rounded-lg px-2 py-1 text-[10px] text-secondary hover:bg-gray-100 dark:text-white/60 dark:hover:bg-white/[0.06]">Cancelar</button>
            <button type="submit" disabled={!projectName.trim() || creating} className="rounded-lg bg-[#0A2540] px-2.5 py-1 text-[10px] font-semibold text-white disabled:opacity-40 dark:bg-accent dark:text-[#071018]">{creating ? 'Creando…' : 'Crear'}</button>
          </div>
        </form>
      )}
      {props.isOpen && loading && <p className="px-3 py-2 text-[11px] text-secondary/70">Cargando proyectos…</p>}
      {props.isOpen && error && <button onClick={() => void load(true)} className="mx-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-left text-[10px] text-amber-800">{error} Reintentar</button>}
      {projects.map((project) => <button key={project.project_id} onClick={() => props.onOpenUnifiedProject?.(project.workspace_id, project.project_id)}
        className={`flex min-h-9 w-full items-center gap-2 rounded-xl px-2 text-left text-[12px] transition-colors ${props.activeUnifiedProjectId === project.project_id ? 'bg-[#0A2540]/10 font-semibold text-[#0A2540] dark:bg-accent/10 dark:text-accent' : 'text-secondary hover:bg-gray-100 dark:text-white/60 dark:hover:bg-white/[0.04]'}`}
        title={`${project.workspaceName} · ${project.project_key}`}>
        <span className="h-2 w-2 rounded-full bg-emerald-400" /><span className="min-w-0 flex-1 truncate">{project.project_name}</span><span className="text-[9px] tabular-nums opacity-60">{project.completion_percentage}%</span>
      </button>)}
      {props.isOpen && !loading && !error && projects.length === 0 && <p className="px-3 py-2 text-[11px] text-secondary/60">Aún no hay proyectos.</p>}
    </>
  );
}
