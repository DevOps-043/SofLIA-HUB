import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { DirectProjectBackend } from '../project-hub/direct-backend';
import { ProjectHubApiService, getProjectHubApiService } from '../project-hub/service';
import { resetAuthStateForTests, setAuthState } from '../main/auth-state';
import { ProjectCreationService } from '../project-hub/project-creation';

const actor = '1d985e38-386a-4873-bba0-47256190c026', other = '4f5bd581-072b-4b5e-b7b0-3c70c46df8d5';
const organization = '81f8215e-8d3b-4bd8-b686-bb4c35d9493b', workspace = '268a31b6-b04c-4e80-8915-72bb47b8d5d4', projectId = 'a27caaec-b6bb-4ffb-9a52-0c5771ea83f7';
type Row = Record<string, unknown>;
let tables: Record<string, Row[]>;
let selection: { userId: string | null; organizationId: string | null; revision: number };
let identity: string | null;
let api: ProjectHubApiService;
let calls: Array<{ url: URL; method: string; body?: Row | Row[] }>;
let failTable: string | undefined;
let failCode = '42501';
let afterQuery: ((table: string) => void) | undefined;
const auth = { userId: actor, assertCurrent: () => {}, signal: new AbortController().signal };

function client(host: string) {
  return createClient(`https://${host}.supabase.co`, 'clave-publica-ficticia', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (input, init) => {
    const url = new URL(String(input)); const table = url.pathname.split('/').pop()!; const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) as Row | Row[] : undefined;
    calls.push({ url, method, body });
    if (table === failTable) return Response.json({ code: failCode, message: 'mensaje sensible que no debe salir' }, { status: 403 });
    const matches = (row: Row) => [...url.searchParams].every(([field, value]) => {
      if (value.startsWith('eq.')) return String(row[field]) === value.slice(3);
      if (value === 'is.null') return row[field] == null;
      if (value === 'not.is.null') return row[field] != null;
      if (value.startsWith('in.(')) return value.slice(4, -1).split(',').includes(String(row[field]));
      if (value.startsWith('lte.')) return row[field] != null && Number(row[field]) <= Number(value.slice(4));
      if (value.startsWith('gt.')) return row[field] != null && Number(row[field]) > Number(value.slice(3));
      return true;
    });
    tables[table] ??= [];
    let rows = tables[table].filter(matches);
    if (method === 'POST') {
      const values = Array.isArray(body) ? body : [body!];
      rows = values.map(value => ({ updated_at: '2026-10-24T12:00:00Z', archived_at: null, ...value }));
      tables[table].push(...rows);
    } else if (method === 'PATCH') rows.forEach(row => Object.assign(row, body));
    else if (method === 'DELETE') tables[table] = tables[table].filter(row => !matches(row));
    const offset = Number(url.searchParams.get('offset') ?? 0), limit = Number(url.searchParams.get('limit') ?? 10000);
    rows = rows.slice(offset, offset + limit);
    afterQuery?.(table);
    const single = new Headers(init?.headers).get('accept')?.includes('vnd.pgrst.object');
    return Response.json(single ? rows[0] ?? null : rows);
  } } });
}
beforeEach(() => {
  resetAuthStateForTests(); setAuthState({ authenticated: true, userId: actor });
  selection = { userId: actor, organizationId: organization, revision: 1 }; identity = actor;
  calls = []; failTable = undefined; failCode = '42501'; afterQuery = undefined;
  tables = {
    organization_users: [{ organization_id: organization, user_id: actor, role: 'member', status: 'active' }],
    organizations: [{ id: organization, name: 'Organización de Learning', slug: 'org-learning', is_active: true }],
    workspaces: [{ workspace_id: workspace, sofia_org_id: organization, name: 'Organización de Learning', slug: 'org-learning', is_active: true }],
    account_users: [{ user_id: actor, sofia_user_id: actor }],
    workspace_members: [{ workspace_id: workspace, user_id: actor, iris_role: 'member', is_active: true }],
    pm_projects: [{ project_id: projectId, workspace_id: workspace, project_name: 'Proyecto propio', created_by_user_id: actor, archived_at: null, team_id: null, updated_at: '2026-10-24T12:00:00Z' }],
    pm_project_members: [],
  };
  const iris = client('iris-directa'), sofia = client('learning-directa');
  const backend = new DirectProjectBackend({ clients: async () => ({ iris, sofia }), identity: async () => identity, selection: async () => ({ ...selection }), currentScope: () => ({ ...selection }) });
  api = new ProjectHubApiService('', undefined, backend);
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No se debe contactar ninguna API web'); }));
});
afterEach(() => { vi.unstubAllGlobals(); resetAuthStateForTests(); });

describe('Proyectos mediante la base de datos directa', () => {
  function taskTeam(owner = actor) {
    tables.pm_projects[0].team_id = other;
    tables.teams = [{ team_id: other, workspace_id: workspace, owner_id: owner, status: 'active' }];
    tables.task_statuses = [];
  }
  it('consultar fases no escribe estados y sólo permite configurarlas al administrador del equipo', async () => {
    taskTeam();
    const result = await api.getTaskOptions({ workspaceId: workspace, projectId }, auth);
    expect(result).toMatchObject({ success: true, data: { statuses: [], can_manage_statuses: true } });
    expect(calls.some(call => call.method !== 'GET')).toBe(false);
  });
  it('materializa una fase solicitada con ID estable y reutiliza el estado en la siguiente tarea', async () => {
    taskTeam();
    const input = { workspaceId: workspace, projectId, task: { title: 'Preparar entrega', status_stage: 'pending' as const, started_at: '2026-11-01T00:00:00Z', due_date: '2026-11-10', external_links: [{ type: 'team_chat' as const, name: 'Chat del equipo', url: 'https://chat.example.test/equipo?token=secreto' }] } };
    const result = await api.createTask(input, auth);
    expect(result).toMatchObject({ success: true, data: { started_at: input.task.started_at, external_links: [{ type: 'team_chat', name: 'Chat del equipo', url: 'https://chat.example.test/equipo' }] } });
    expect(tables.task_statuses[0]).toMatchObject({ team_id: other, name: 'Pendientes', status_type: 'todo' });
    expect(tables.task_issues[0].status_id).toBe(tables.task_statuses[0].status_id);
    expect(tables.task_issues[0]).not.toHaveProperty('status_stage');
    expect((await api.createTask(input, auth)).success).toBe(true);
    expect(tables.task_statuses).toHaveLength(1);
  });
  it('la propiedad del proyecto no concede administración del equipo para inventar fases', async () => {
    taskTeam(other);
    const result = await api.createTask({ workspaceId: workspace, projectId, task: { title: 'Tarea', status_stage: 'in_progress' } }, auth);
    expect(result).toMatchObject({ success: false, code: 'PROJECT_FORBIDDEN' });
    expect(calls.some(call => call.method !== 'GET')).toBe(false);
  });
  it('un integrante reutiliza fases existentes sin administrar los estados', async () => {
    taskTeam(other);tables.task_statuses.push({ status_id: other, team_id: other, name: 'En curso', status_type: 'in_progress' });
    expect(await api.createTask({ workspaceId: workspace, projectId, task: { title: 'Continuar tarea', status_stage: 'in_progress' } }, auth)).toMatchObject({ success: true, data: { status_id: other } });
    expect(calls.some(call => call.method === 'POST' && call.url.pathname.endsWith('/task_statuses'))).toBe(false);
  });
  it('valida fechas combinadas con los valores existentes antes de crear estados o escribir tareas', async () => {
    taskTeam();tables.task_issues = [{ issue_id: other, project_id: projectId, team_id: other, title: 'Anterior', due_date: '2026-11-01', updated_at: '2026-10-24T12:00:00Z' }];
    expect(await api.updateTask({ workspaceId: workspace, projectId, taskId: other, updates: { started_at: '2026-11-02T00:00:00Z', status_stage: 'done' } }, auth)).toMatchObject({ success: false, code: 'INVALID_REFERENCE' });
    expect(calls.some(call => call.method !== 'GET')).toBe(false);
  });
  it.each(['sin-url', 'javascript:alert(1)', 'file:///C:/archivo', 'https://persona:clave@example.test/foto'])('rechaza el recurso inseguro %s antes de escribir', async url => {
    taskTeam();
    expect((await api.createTask({ workspaceId: workspace, projectId, task: { title: 'Tarea', status_stage: 'todo', external_links: [{ type: 'photo', name: 'Foto', url }] } }, auth)).success).toBe(false);
    expect(calls.some(call => call.method !== 'GET')).toBe(false);
  });
  it.each([['PT401','NOT_AUTHENTICATED'],['PT403','WORKSPACE_FORBIDDEN'],['PT503','DATABASE_UNAVAILABLE']])('traduce el rechazo verificado %s sin mensajes internos', async (code, expected) => {
    failTable = 'workspaces'; failCode = code;
    const result = await api.listProjects({ workspaceId: workspace }, auth);
    expect(result).toMatchObject({ success: false, code: expected });
    expect(JSON.stringify(result)).not.toContain('mensaje sensible');
  });
  it('el listado informa propiedad y roles activos sin eliminar proyectos editables ni consultar cada detalle', async () => {
    const memberProject = '12aacaec-b6bb-4ffb-9a52-0c5771ea83f7', viewerProject = '23aacaec-b6bb-4ffb-9a52-0c5771ea83f7';
    tables.pm_projects.push({ ...tables.pm_projects[0], project_id: memberProject, created_by_user_id: other }, { ...tables.pm_projects[0], project_id: viewerProject, created_by_user_id: other });
    tables.pm_project_members.push({ project_id: memberProject, user_id: actor, project_role: 'member', membership_status: 'active' }, { project_id: viewerProject, user_id: actor, project_role: 'viewer', membership_status: 'active' });
    const result = await api.listProjects({ workspaceId: workspace }, auth);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ project_id: projectId, role: 'owner', membership: { project_role: 'owner' } }),
      expect.objectContaining({ project_id: memberProject, role: 'member' }),
      expect.objectContaining({ project_id: viewerProject, role: 'viewer' }),
    ]));
    expect(calls.filter(call => call.url.pathname.endsWith('/pm_project_members'))).toHaveLength(1);
    expect(calls.filter(call => call.url.pathname.endsWith('/pm_projects'))).toHaveLength(1);
  });
  it('el rol administrativo del listado coincide con el acceso efectivo del detalle', async () => {
    tables.workspace_members[0].iris_role = 'admin';
    tables.organization_users[0].role = 'admin';
    const result = await api.listProjects({ workspaceId: workspace }, auth);
    expect(result.data).toEqual([expect.objectContaining({ role: 'admin', membership: { project_role: 'admin' } })]);
  });
  it('un espejo con rol administrativo no eleva el rol vigente de Learning', async () => {
    tables.workspace_members[0].iris_role = 'admin';
    tables.pm_projects.push({ ...tables.pm_projects[0], project_id: other, created_by_user_id: other });
    const result = await api.listProjects({ workspaceId: workspace }, auth);
    expect(result.success).toBe(true);
    expect(result.data).toEqual([expect.objectContaining({ project_id: projectId, role: 'owner' })]);
    expect(await api.addEvidence({ workspaceId: workspace, projectId: other, evidence: { type: 'link', title: 'Ajeno', metadata: {}, items: [] } }, auth)).toMatchObject({ success: false, code: 'PROJECT_FORBIDDEN' });
  });
  it.each([['low', [1, 2]], ['medium', [3, 5]], ['high', [8, 13]], ['unestimated', [null]]])('filtra dificultad %s en la base antes de paginar', async (difficulty, expected) => {
    tables.task_issues = [null, 1, 2, 3, 5, 8, 13].map((points, index) => ({ issue_id: `task-${index}`, project_id: projectId, archived_at: null, estimate_points: points }));
    const result = await api.listTasks({ workspaceId: workspace, projectId, difficulty: difficulty as 'low' | 'medium' | 'high' | 'unestimated' }, auth);
    expect(result.success).toBe(true);
    expect((result.data as Row[]).map(row => row.estimate_points)).toEqual(expected);
    const query = calls.find(call => call.url.pathname.endsWith('/task_issues'))!.url;
    expect(query.searchParams.has('estimate_points')).toBe(true);
    expect(query.searchParams.has('priority_id')).toBe(false);
  });
  it('la instancia de producción utiliza la base directa y no consulta la web sin sesión', async () => {
    setAuthState({ authenticated: false, userId: null });
    expect(await getProjectHubApiService().getStatus()).toMatchObject({ connection: 'database', authenticated: false, workspaces: [] });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('obtiene estado y crea sin equipo ni token o petición a la API web', async () => {
    expect(await api.getStatus(auth)).toMatchObject({ authenticated: true, connection: 'database', workspaces: [{ id: workspace }] });
    const result = await api.createProject({ workspaceId: workspace, project: { name: 'Nuevo directo' } }, auth);
    expect(result).toMatchObject({ success: true, data: { workspace_id: workspace, team_id: null, created_by_user_id: actor, role: 'owner' } });
    expect(calls.filter(call => call.method === 'POST')).toHaveLength(1);
    expect(calls.some(call => call.url.pathname.includes('/api/v1/'))).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('rechaza un workspace de otra organización antes de consultar o crear proyectos', async () => {
    expect(await api.createProject({ workspaceId: other, project: { name: 'Ajeno' } }, auth)).toMatchObject({ success: false, code: 'WORKSPACE_FORBIDDEN' });
    expect(calls.some(call => call.url.pathname.endsWith('/pm_projects'))).toBe(false);
  });
  it('deniega sin membresía activa en Learning', async () => {
    tables.organization_users[0].status = 'removed';
    expect(await api.listProjects({ workspaceId: workspace }, auth)).toMatchObject({ success: false, code: 'WORKSPACE_FORBIDDEN' });
    expect(calls.some(call => call.url.hostname.startsWith('iris-'))).toBe(false);
  });
  it('no confía en una sesión SOFIA de otro usuario', async () => {
    identity = other;
    expect(await api.listProjects({ workspaceId: workspace }, auth)).toMatchObject({ success: false, code: 'SOFIA_SESSION_PENDING' });
    expect(calls).toHaveLength(0);
  });
  it('mantiene todos los listados de proyectos limitados al workspace', async () => {
    tables.pm_projects.push({ project_id: other, workspace_id: other, created_by_user_id: actor });
    const result = await api.listProjects({ workspaceId: workspace }, auth);
    expect(result.success).toBe(true); expect(result.data).toHaveLength(1);
    expect(calls.find(call => call.url.pathname.endsWith('/pm_projects'))?.url.searchParams.get('workspace_id')).toBe(`eq.${workspace}`);
  });
  it('rechaza un proyecto ajeno y un lector no puede editar', async () => {
    tables.pm_projects[0].created_by_user_id = other;
    expect(await api.getProject({ workspaceId: workspace, projectId }, auth)).toMatchObject({ success: false, code: 'PROJECT_FORBIDDEN' });
    tables.pm_project_members.push({ project_id: projectId, user_id: actor, project_role: 'viewer', membership_status: 'active' });
    expect((await api.getProject({ workspaceId: workspace, projectId }, auth)).success).toBe(true);
    expect(await api.updateProject({ workspaceId: workspace, projectId, updates: { name: 'No permitido' } }, auth)).toMatchObject({ success: false, code: 'PROJECT_FORBIDDEN' });
    expect(calls.some(call => call.method === 'PATCH')).toBe(false);
  });
  it('descarta respuestas si cambia la organización o la sesión A/B/A', async () => {
    afterQuery = table => { if (table === 'pm_projects') selection = { ...selection, revision: 3 }; };
    expect(await api.listProjects({ workspaceId: workspace }, auth)).toMatchObject({ success: false, code: 'SESSION_CHANGED' });
    selection.revision = 1;
    afterQuery = table => { if (table === 'pm_projects') { setAuthState({ authenticated: true, userId: other }); setAuthState({ authenticated: true, userId: actor }); } };
    expect(await api.listProjects({ workspaceId: workspace }, auth)).toMatchObject({ success: false, code: 'SESSION_CHANGED' });
  });
  it('un fallo después de escribir se declara incierto sin repetir', async () => {
    afterQuery = table => { if (table === 'pm_projects') selection.revision++; };
    expect(await api.createProject({ workspaceId: workspace, project: { name: 'Pendiente' } }, auth)).toMatchObject({ success: false, uncertain: true, recoveryRequired: true });
    expect(calls.filter(call => call.method === 'POST')).toHaveLength(1);
  });
  it('una revocación de membresía durante la preparación impide la escritura', async () => {
    afterQuery = table => { if (table === 'pm_projects') tables.organization_users[0].status = 'removed'; };
    expect(await api.updateProject({ workspaceId: workspace, projectId, updates: { name: 'No guardar' } }, auth)).toMatchObject({ success: false, code: 'WORKSPACE_FORBIDDEN' });
    expect(calls.some(call => call.method === 'PATCH')).toBe(false);
  });
  it('un rechazo de permisos de la base no filtra su mensaje ni usa la API como fallback', async () => {
    failTable = 'pm_projects';
    expect(await api.createProject({ workspaceId: workspace, project: { name: 'Rechazado' } }, auth)).toMatchObject({ success: false, code: 'DATABASE_FORBIDDEN' });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('no activa una membresía de espacio suspendida', async () => {
    tables.workspace_members[0].is_active = false;
    expect(await api.getStatus(auth)).toMatchObject({ authenticated: false });
    expect(calls.some(call => call.method !== 'GET')).toBe(false);
  });
  it('las secciones vacías del proyecto se consultan directamente sin equipo', async () => {
    const target = { workspaceId: workspace, projectId };
    for (const read of [() => api.listTasks(target, auth), () => api.listMembers(target, auth), () => api.listEvidence(target, auth), () => api.listMilestones(target, auth), () => api.listDocuments(target, auth), () => api.getProjectTeam(target, auth), () => api.getTaskOptions(target, auth), () => api.getAnalytics(target, auth)]) expect((await read()).success).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('creación configurada usa el mismo backend directo y conserva la ubicación', async () => {
    const store = { read: vi.fn().mockResolvedValue(null), write: vi.fn().mockResolvedValue(undefined) };
    const creation = new ProjectCreationService({ store, defaultDirectory: '', service: api, resolveOrganization: async () => ({ workspaceId: workspace, name: 'Learning', role: 'member' }), cloud: { prepare: vi.fn().mockResolvedValue({}), create: vi.fn().mockResolvedValue({ provider: 'google_drive', accountEmail: 'demo@example.test', folderId: 'folder', name: 'Proyecto' }) } as never });
    try {
      const result = await creation.create({ operationId: crypto.randomUUID(), organizationId: organization, name: 'Proyecto', storage: { mode: 'google_drive', parentSelectionId: organization }, additionalSelectionIds: [] }, auth);
      expect(result.success).toBe(true); expect(store.write).toHaveBeenCalledWith(actor, expect.stringContaining('project/'), expect.objectContaining({ mode: 'google_drive' }), expect.any(Function));
      expect(fetch).not.toHaveBeenCalled();
    } finally { creation.dispose(); }
  });
  it('editar, crear hitos y vincular documentos mantiene los contratos de las secciones', async () => {
    const target = { workspaceId: workspace, projectId };
    expect(await api.updateProject({ ...target, updates: { name: 'Actualizado' } }, auth)).toMatchObject({ success: true, data: { project_name: 'Actualizado' } });
    expect(await api.createMilestone({ ...target, milestone: { name: 'Entrega', target_date: '2026-12-01' } }, auth)).toMatchObject({ success: true, data: { project_id: projectId, milestone_name: 'Entrega' } });
    expect(await api.createDocument({ ...target, document: { name: 'Documento', provider: 'google_docs', external_id: 'documento', external_url: 'https://docs.google.com/document/d/documento', doc_type: 'document' } }, auth)).toMatchObject({ success: true, data: { project_id: projectId, name: 'Documento' } });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('mantiene al creador como propietario sin depender de una segunda inserción', async () => {
    const result = await api.listMembers({ workspaceId: workspace, projectId }, auth);
    expect(result).toMatchObject({ success: true, data: [{ project_role: 'owner', user_id: actor }] });
    expect(calls.some(call => call.method === 'POST')).toBe(false);
  });
  it('no añade colaboradores de otro workspace', async () => {
    expect(await api.addMember({ workspaceId: workspace, projectId, userId: other, role: 'member' }, auth)).toMatchObject({ success: false, code: 'INVALID_REFERENCE' });
    expect(calls.some(call => call.method === 'POST')).toBe(false);
  });
  it('el directorio de equipos oculta los equipos privados ajenos', async () => {
    tables.teams = [{ team_id: other, workspace_id: workspace, visibility: 'private', owner_id: other, status: 'active', name: 'Privado' }];
    tables.pm_projects[0].team_id = other;
    expect(await api.getProjectTeam({ workspaceId: workspace, projectId }, auth)).toMatchObject({ success: true, data: { restricted: true, team: null, members: [], available: [] } });
    const memberReads = calls.filter(call => call.url.pathname.endsWith('/team_members'));
    expect(memberReads).toHaveLength(1);
    expect(memberReads[0].url.searchParams.get('user_id')).toBe(`eq.${actor}`);
  });
  it('las tareas necesitan equipo propio pero los proyectos no', async () => {
    expect(await api.createTask({ workspaceId: workspace, projectId, task: { title: 'Tarea' } }, auth)).toMatchObject({ success: false, code: 'PROJECT_TEAM_REQUIRED' });
    expect(calls.some(call => call.method === 'POST')).toBe(false);
    tables.pm_projects[0].team_id = other;
    tables.task_statuses = [{ status_id: other, team_id: other, status_type: 'todo', is_closed: false }];
    expect(await api.createTask({ workspaceId: workspace, projectId, task: { title: 'Tarea' } }, auth)).toMatchObject({ success: true, data: { project_id: projectId, team_id: other, creator_id: actor, title: 'Tarea' } });
  });
  it('no acepta equipo explícito ajeno al crear', async () => {
    tables.teams = [{ team_id: other, workspace_id: other, status: 'active' }];
    expect(await api.createProject({ workspaceId: workspace, project: { name: 'Proyecto', team_id: other } }, auth)).toMatchObject({ success: false, code: 'INVALID_REFERENCE' });
    expect(calls.some(call => call.method === 'POST')).toBe(false);
  });
  it('conserva un efecto parcial de evidencia sin repetir ni ocultar el fallo', async () => {
    failTable = 'pm_project_evidence_items';
    expect(await api.addEvidence({ workspaceId: workspace, projectId, evidence: { type: 'link', source_system: 'hub', title: 'Referencia', items: [{ type: 'excerpt', position: 0, content: 'Texto' }] } }, auth)).toMatchObject({ success: false, code: 'DATABASE_FORBIDDEN', uncertain: true, recoveryRequired: true });
    expect(calls.filter(call => call.method === 'POST' && call.url.pathname.endsWith('/pm_project_evidence'))).toHaveLength(1);
  });
  it('sin espejo organizativo lo crea desde Learning y conserva un único espacio', async () => {
    tables.workspaces = [];
    // La respuesta de Supabase aporta el identificador generado del espacio.
    afterQuery = table => { if (table === 'workspaces' && tables.workspaces[0]) tables.workspaces[0].workspace_id = workspace; };
    expect(await api.getStatus(auth)).toMatchObject({ authenticated: true });
    expect(tables.workspaces).toHaveLength(1);
    expect(tables.workspaces[0].sofia_org_id).toBe(organization);
    expect(fetch).not.toHaveBeenCalled();
  });
});
