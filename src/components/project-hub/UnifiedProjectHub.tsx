import { useCallback, useEffect, useRef, useState } from 'react';
import { integratedBrowserService, type BrowserTabSummary } from '../../services/integrated-browser-service';
import { projectHubApi, type ProjectHubProject } from '../../services/project-hub-api';

type Tab = 'summary' | 'chats' | 'tasks' | 'sources' | 'members' | 'analytics';
type Task = { issue_id: string; issue_number: number; title: string; due_date?: string | null; task_statuses?: { name?: string } | Array<{ name?: string }> };
type Evidence = { evidence_id: string; evidence_type: string; title: string; summary?: string; created_at: string; metadata?: Record<string, unknown> };
type Member = { member_id: string; project_role: string; user?: { display_name?: string; email?: string } | Array<{ display_name?: string; email?: string }> };
type EvidenceItem = { item_type?: string; source_url?: string | null };

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'summary', label: 'Resumen' }, { id: 'chats', label: 'Chats' }, { id: 'tasks', label: 'Tareas' },
  { id: 'sources', label: 'Fuentes y evidencias' }, { id: 'members', label: 'Miembros' }, { id: 'analytics', label: 'Analítica' },
];

export function UnifiedProjectHub({ workspaceId, projectId }: { workspaceId: string; projectId: string }) {
  const [tab, setTab] = useState<Tab>('summary');
  const [project, setProject] = useState<ProjectHubProject | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [analytics, setAnalytics] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [browserTabs, setBrowserTabs] = useState<BrowserTabSummary[] | null>(null);
  const [selectedTabIds, setSelectedTabIds] = useState<Set<string>>(new Set());
  const fileInput = useRef<HTMLInputElement>(null);

  const loadProject = useCallback(async () => {
    setLoading(true); setError(null);
    const result = await projectHubApi.getProject(workspaceId, projectId);
    if (!result.success || !result.data) setError(result.error || 'No se pudo abrir el proyecto.');
    else setProject(result.data);
    setLoading(false);
  }, [projectId, workspaceId]);

  const loadTab = useCallback(async (target: Tab) => {
    if (target === 'tasks') { const result = await projectHubApi.listTasks(workspaceId, projectId); if (result.success) setTasks(result.data as Task[]); else setError(result.error || null); }
    if (target === 'sources') { const result = await projectHubApi.listEvidence(workspaceId, projectId); if (result.success) setEvidence(result.data as Evidence[]); else setError(result.error || null); }
    if (target === 'members') { const result = await projectHubApi.listMembers(workspaceId, projectId); if (result.success) setMembers(result.data as Member[]); else setError(result.error || null); }
    if (target === 'analytics' || target === 'summary') { const result = await projectHubApi.analytics(workspaceId, projectId); if (result.success) setAnalytics(result.data || null); }
  }, [projectId, workspaceId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadProject(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadProject]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void loadTab(tab); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadTab, tab]);

  const createTask = async () => {
    const title = window.prompt('Título de la tarea');
    if (!title?.trim()) return;
    const result = await projectHubApi.createTask(workspaceId, projectId, { title: title.trim() });
    if (!result.success) setError(result.error || 'No se pudo crear la tarea.'); else await loadTab('tasks');
  };

  const addLink = async (drive = false) => {
    const url = window.prompt(drive ? 'Enlace del archivo en Drive' : 'URL de la fuente');
    if (!url?.trim()) return;
    const title = window.prompt('Título de la fuente')?.trim() || (drive ? 'Archivo de Drive' : 'Enlace');
    const result = await projectHubApi.addEvidence(workspaceId, projectId, {
      type: drive ? 'drive_file' : 'link', source_system: drive ? 'google-drive' : 'web', title,
      external_reference: url, version: 1, metadata: { url }, items: [],
    });
    if (!result.success) setError(result.error || 'No se pudo anexar la fuente.'); else await loadTab('sources');
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const result = await projectHubApi.uploadFiles(workspaceId, projectId, [...files]);
    if (!result.success) setError(result.error || 'No se pudieron subir los archivos.'); else await loadTab('sources');
    if (fileInput.current) fileInput.current.value = '';
  };

  const prepareBrowserCollection = async () => {
    const result = await integratedBrowserService.getTabSummaries();
    if (!result.success || !result.summaries?.length) return setError(result.error || 'No hay pestañas disponibles.');
    setBrowserTabs(result.summaries.slice(0, 50));
    setSelectedTabIds(new Set(result.summaries.filter((item) => item.isCurrent).map((item) => item.tabId)));
  };

  const saveBrowserCollection = async () => {
    const selected = (browserTabs || []).filter((item) => selectedTabIds.has(item.tabId));
    if (!selected.length) return;
    const name = window.prompt('Nombre de la investigación')?.trim();
    if (!name) return;
    const reference = crypto.randomUUID();
    const tabs = await Promise.all(selected.map(async (item, position) => ({
      type: 'tab', position, title: item.title.slice(0, 500), source_url: item.url,
      content: item.text.slice(0, 51_200), source_hash: await sha256(item.text), metadata: { captured_at: new Date().toISOString() },
    })));
    const result = await projectHubApi.createBrowserCollection(workspaceId, projectId, { name, external_reference: reference, version: 1, tabs });
    if (!result.success) setError(result.error || 'No se pudo guardar la investigación.');
    else { setBrowserTabs(null); await loadTab('sources'); }
  };

  const addMember = async () => {
    const userId = window.prompt('UUID del usuario del workspace');
    if (!userId?.trim()) return;
    const result = await projectHubApi.addMember(workspaceId, projectId, userId.trim(), 'member');
    if (!result.success) setError(result.error || 'No se pudo agregar al miembro.'); else await loadTab('members');
  };

  const updateMemberRole = async (memberId: string, role: string) => {
    const result = await projectHubApi.updateMember(workspaceId, projectId, memberId, role);
    if (!result.success) setError(result.error || 'No se pudo cambiar el rol.'); else await loadTab('members');
  };

  const removeMember = async (member: Member) => {
    if (!window.confirm('¿Remover a este miembro del proyecto y revocar su acceso compartido?')) return;
    const result = await projectHubApi.removeMember(workspaceId, projectId, member.member_id);
    if (!result.success) setError(result.error || 'No se pudo remover al miembro.'); else await loadTab('members');
  };

  const openBrowserCollection = async (evidenceId: string) => {
    const result = await projectHubApi.getEvidence(workspaceId, projectId, evidenceId);
    if (!result.success || !result.data) return setError(result.error || 'No se pudo abrir la investigación.');
    const rawItems = result.data.pm_project_evidence_items;
    const items = Array.isArray(rawItems) ? rawItems as EvidenceItem[] : [];
    const urls = items.filter((item) => item.item_type === 'tab' && typeof item.source_url === 'string')
      .map((item) => item.source_url as string).slice(0, 50);
    if (!urls.length) return setError('La investigación no contiene URLs disponibles.');
    for (const url of urls) {
      const opened = await integratedBrowserService.createTab(url);
      if (!opened.success) return setError(opened.error || 'No se pudieron abrir todas las pestañas.');
    }
  };

  if (loading) return <div className="grid h-full place-items-center text-sm text-secondary">Cargando proyecto…</div>;
  if (!project) return <div className="grid h-full place-items-center"><button onClick={() => void loadProject()} className="rounded-xl border px-4 py-2 text-sm">{error || 'Proyecto no disponible'} · Reintentar</button></div>;

  return <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#f7f9fb] dark:bg-[#080b11]">
    <header className="border-b border-gray-200/70 bg-white px-7 pb-0 pt-6 dark:border-white/10 dark:bg-[#0d1118]">
      <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-secondary/60">{project.project_key}</p><h1 className="mt-1 text-2xl font-bold text-[#0A2540] dark:text-white">{project.project_name}</h1><p className="mt-1 max-w-3xl text-sm text-secondary dark:text-white/55">{project.project_description || 'Sin descripción todavía.'}</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">{project.project_status}</span></div>
      <nav className="mt-6 flex gap-1 overflow-x-auto">{TABS.map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={`whitespace-nowrap border-b-2 px-3 py-2 text-xs font-semibold ${tab === item.id ? 'border-accent text-[#0A2540] dark:text-accent' : 'border-transparent text-secondary/70 dark:text-white/45'}`}>{item.label}</button>)}</nav>
    </header>
    {error && <div className="mx-7 mt-4 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800"><span>{error}</span><button onClick={() => setError(null)}>Cerrar</button></div>}
    <section className="min-h-0 flex-1 overflow-y-auto p-7">
      {tab === 'summary' && <Summary project={project} analytics={analytics} />}
      {tab === 'chats' && <Empty title="Chats del proyecto" text="La carpeta colaborativa de Lia se crea y reintenta mediante el outbox. Los chats heredados no se mueven automáticamente." />}
      {tab === 'tasks' && <Panel title="Tareas" action="Nueva tarea" onAction={() => void createTask()}>{tasks.length ? <div className="space-y-2">{tasks.map((task) => <div key={task.issue_id} className="rounded-xl border border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.03]"><p className="text-sm font-semibold">#{task.issue_number} {task.title}</p><p className="mt-1 text-xs text-secondary/70">{task.due_date ? `Vence ${task.due_date}` : 'Sin fecha compromiso'}</p></div>)}</div> : <Empty title="Sin tareas" text="Crea la primera tarea o aprueba acciones de una reunión." />}</Panel>}
      {tab === 'sources' && <Panel title="Fuentes y evidencias"><div className="mb-4 flex flex-wrap gap-2"><Action label="Subir archivos" onClick={() => fileInput.current?.click()} /><Action label="Vincular Drive" onClick={() => void addLink(true)} /><Action label="Añadir enlace" onClick={() => void addLink()} /><Action label="Guardar pestañas" onClick={() => void prepareBrowserCollection()} /><input ref={fileInput} type="file" multiple className="hidden" onChange={(event) => void upload(event.target.files)} /></div>{evidence.length ? <div className="grid gap-3 md:grid-cols-2">{evidence.map((item) => <div key={item.evidence_id} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]"><p className="text-[10px] font-bold uppercase tracking-wider text-secondary/60">{item.evidence_type}</p><h3 className="mt-1 text-sm font-semibold">{item.title}</h3><p className="mt-1 line-clamp-2 text-xs text-secondary/70">{item.summary || new Date(item.created_at).toLocaleString()}</p>{item.evidence_type === 'browser_collection' && <button onClick={() => void openBrowserCollection(item.evidence_id)} className="mt-3 text-xs font-semibold text-[#0A6C8F] hover:underline dark:text-accent">Abrir todas</button>}</div>)}</div> : <Empty title="Sin evidencia" text="Sube archivos, vincula Drive o guarda una investigación del navegador." />}</Panel>}
      {tab === 'members' && <Panel title="Miembros" action="Agregar" onAction={() => void addMember()}>{members.length ? <div className="space-y-2">{members.map((member) => { const user = Array.isArray(member.user) ? member.user[0] : member.user; return <div key={member.member_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.03]"><div><p className="text-sm font-semibold">{user?.display_name || user?.email || 'Usuario'}</p><p className="text-xs text-secondary/60">{user?.email}</p></div><div className="flex items-center gap-2"><select value={member.project_role} onChange={(event) => void updateMemberRole(member.member_id, event.target.value)} className="rounded-lg border border-gray-200 bg-transparent px-2 py-1 text-xs dark:border-white/15"><option value="owner">Owner</option><option value="admin">Admin</option><option value="member">Member</option><option value="viewer">Viewer</option><option value="guest">Guest</option></select><button disabled={member.project_role === 'owner'} onClick={() => void removeMember(member)} className="rounded-lg px-2 py-1 text-xs font-semibold text-red-600 disabled:cursor-not-allowed disabled:opacity-35">Remover</button></div></div>; })}</div> : <Empty title="Sin miembros visibles" text="El owner se agrega al crear el proyecto." />}</Panel>}
      {tab === 'analytics' && <Analytics data={analytics} />}
    </section>
    {browserTabs && <CollectionDialog tabs={browserTabs} selected={selectedTabIds} onToggle={(id) => setSelectedTabIds((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; })} onCancel={() => setBrowserTabs(null)} onSave={() => void saveBrowserCollection()} />}
  </div>;
}

function Summary({ project, analytics }: { project: ProjectHubProject; analytics: Record<string, unknown> | null }) { const progress = typeof analytics?.progress === 'number' ? analytics.progress : project.completion_percentage; return <div className="grid gap-4 lg:grid-cols-3"><div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]"><p className="text-xs font-semibold text-secondary">Progreso</p><p className="mt-2 text-3xl font-bold">{progress}%</p><div className="mt-3 h-2 rounded-full bg-gray-100"><div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} /></div></div><div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]"><p className="text-xs font-semibold text-secondary">Prioridad</p><p className="mt-2 text-xl font-bold capitalize">{project.priority_level}</p></div><div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]"><p className="text-xs font-semibold text-secondary">Salud</p><p className="mt-2 text-xl font-bold capitalize">{project.health_status}</p></div></div>; }
function Panel({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children: React.ReactNode }) { return <div className="mx-auto max-w-5xl"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">{title}</h2>{action && <Action label={action} onClick={onAction!} />}</div>{children}</div>; }
function Action({ label, onClick }: { label: string; onClick: () => void }) { return <button onClick={onClick} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold shadow-sm hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.04]">{label}</button>; }
function Empty({ title, text }: { title: string; text: string }) { return <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-gray-300 bg-white/60 p-8 text-center dark:border-white/15 dark:bg-white/[0.02]"><h3 className="font-semibold">{title}</h3><p className="mt-2 text-sm text-secondary/70 dark:text-white/45">{text}</p></div>; }
function Analytics({ data }: { data: Record<string, unknown> | null }) { if (!data) return <Empty title="Analítica no disponible" text="Reintenta cuando Project Hub esté disponible." />; return <div className="grid gap-4 md:grid-cols-2"><Metric title="Progreso" value={`${data.progress ?? 0}%`} /><Metric title="Tareas" value={String((data.tasks as { total?: number })?.total ?? 0)} /><Metric title="Reuniones" value={String((data.evidence as { meetings?: number })?.meetings ?? 0)} /><Metric title="Evidencias" value={String((data.evidence as { total?: number })?.total ?? 0)} /></div>; }
function Metric({ title, value }: { title: string; value: string }) { return <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]"><p className="text-xs text-secondary">{title}</p><p className="mt-2 text-3xl font-bold">{value}</p></div>; }
function CollectionDialog({ tabs, selected, onToggle, onCancel, onSave }: { tabs: BrowserTabSummary[]; selected: Set<string>; onToggle: (id: string) => void; onCancel: () => void; onSave: () => void }) { return <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-6"><div className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#111720]"><div className="border-b p-5"><h2 className="text-lg font-bold">Guardar como investigación</h2><p className="text-xs text-secondary">Selecciona hasta 50 pestañas. No se guardan cookies, formularios ni capturas.</p></div><div className="max-h-[55vh] overflow-y-auto p-3">{tabs.map((item) => <label key={item.tabId} className="flex cursor-pointer gap-3 rounded-xl p-3 hover:bg-gray-50 dark:hover:bg-white/[0.04]"><input type="checkbox" checked={selected.has(item.tabId)} onChange={() => onToggle(item.tabId)} /><span className="min-w-0"><span className="block truncate text-sm font-semibold">{item.title || 'Sin título'}</span><span className="block truncate text-xs text-secondary/60">{item.url}</span></span></label>)}</div><div className="flex justify-end gap-2 border-t p-4"><Action label="Cancelar" onClick={onCancel} /><button onClick={onSave} disabled={!selected.size} className="rounded-xl bg-[#0A2540] px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">Guardar {selected.size} pestañas</button></div></div></div>; }
async function sha256(value: string): Promise<string> { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map((byte) => byte.toString(16).padStart(2, '0')).join(''); }
