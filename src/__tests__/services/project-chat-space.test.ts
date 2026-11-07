import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveProjectChatSpace } from '../../services/project-chat-space';
import { readProjectChatBinding } from '../../services/project-chat-binding';
import { projectHubApi } from '../../services/project-hub-api';
import { supabase } from '../../lib/supabase';

vi.mock('../../lib/supabase', () => ({ supabase: { from: vi.fn() } }));
vi.mock('../../services/project-chat-binding', () => ({ readProjectChatBinding: vi.fn() }));
vi.mock('../../services/project-hub-api', () => ({ projectHubApi: { getProject: vi.fn() } }));
const input = { userId: 'usuario', orgId: 'org', workspaceId: 'workspace', projectId: 'project', name: 'Proyecto', create: false, signal: new AbortController().signal };
let rows: Record<string, unknown>[];
let writes: Record<string, unknown>[];
let requests: Array<{ table: string; filters: Record<string, unknown> }>;
let readError: { code: string; message: string } | null;
beforeEach(() => {
  vi.clearAllMocks(); rows = []; writes = []; requests = []; readError = null;
  vi.mocked(readProjectChatBinding).mockResolvedValue(null);
  vi.mocked(projectHubApi.getProject).mockResolvedValue({ success: true, data: { project_id: input.projectId, workspace_id: input.workspaceId, project_name: 'Proyecto', role: 'owner' } } as Awaited<ReturnType<typeof projectHubApi.getProject>>);
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    const filters: Record<string, unknown> = {}; let insert: Record<string, unknown> | undefined;
    const chain = {
      select: () => chain, abortSignal: () => chain,
      eq: (field: string, value: unknown) => { filters[field] = value; return chain; },
      is: (field: string, value: unknown) => { filters[field] = value; return chain; },
      insert: (row: Record<string, unknown>) => { insert = row; return chain; },
      maybeSingle: async () => { requests.push({ table, filters }); return { data: rows.find(row => Object.entries(filters).every(([field, value]) => row[field] === value)) || null, error: readError }; },
      single: async () => { writes.push(insert!); rows.push(insert!); return { data: { ...insert, created_at: '', updated_at: '' }, error: null }; },
    };
    return chain as unknown as ReturnType<typeof supabase.from>;
  });
});
describe('Espacio de chat personal persistente del proyecto', () => {
  it('permite instalaciones sin tabla federada y conserva los errores transitorios como reintentables', async () => {
    const actual = await vi.importActual<typeof import('../../services/project-chat-binding')>('../../services/project-chat-binding');
    for (const code of ['42P01', 'PGRST205', '42501']) {
      readError = { code, message: 'Tabla federada no disponible' };
      expect(await actual.readProjectChatBinding(input.workspaceId, input.projectId, input.signal)).toBeNull();
    }
    readError = { code: '08006', message: 'Conexión interrumpida' };
    await expect(actual.readProjectChatBinding(input.workspaceId, input.projectId, input.signal)).rejects.toThrow('No se pudo comprobar');
  });
  it('leer no crea carpetas y Nuevo chat crea una sola carpeta recuperable', async () => {
    expect(await resolveProjectChatSpace(input)).toBeNull(); expect(writes).toHaveLength(0);
    const first = await resolveProjectChatSpace({ ...input, create: true });
    const second = await resolveProjectChatSpace({ ...input, create: true });
    expect(first?.id).toBe(second?.id); expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ user_id: 'usuario', org_id: 'org', name: 'Proyecto' });
    expect(first?.can_edit).toBe(true);
  });
  it('usuario, organización y proyecto diferentes reciben espacios distintos', async () => {
    for (const scope of [input, { ...input, orgId: 'otra' }, { ...input, userId: 'otra' }, { ...input, projectId: 'otro' }]) {
      vi.mocked(projectHubApi.getProject).mockResolvedValue({ success: true, data: { project_id: scope.projectId, workspace_id: scope.workspaceId, project_name: 'Proyecto', role: 'owner' } } as Awaited<ReturnType<typeof projectHubApi.getProject>>);
      await resolveProjectChatSpace({ ...scope, create: true });
    }
    expect(new Set(writes.map(row => row.id)).size).toBe(4);
    expect(requests.every(request => request.filters.org_id && request.filters.user_id)).toBe(true);
  });
  it('conserva el vínculo federado y nunca sustituye una carpeta ajena por coincidencia de nombre', async () => {
    vi.mocked(readProjectChatBinding).mockResolvedValue('anterior');
    rows.push({ id: 'anterior', user_id: input.userId, org_id: input.orgId, name: 'Proyecto existente' });
    expect(await resolveProjectChatSpace(input)).toMatchObject({ id: 'anterior', name: 'Proyecto existente' });
    rows[0].org_id = 'otra';
    await expect(resolveProjectChatSpace({ ...input, create: true })).rejects.toThrow('No tienes acceso');
    expect(writes).toHaveLength(0);
  });
  it('lectores, fallos de federación y respuestas canceladas no crean una carpeta alternativa', async () => {
    vi.mocked(projectHubApi.getProject).mockResolvedValue({ success: true, data: { project_id: input.projectId, workspace_id: input.workspaceId, project_name: 'Proyecto', role: 'viewer' } } as Awaited<ReturnType<typeof projectHubApi.getProject>>);
    await expect(resolveProjectChatSpace({ ...input, create: true })).rejects.toThrow('permiso'); expect(writes).toHaveLength(0);
    vi.mocked(readProjectChatBinding).mockRejectedValue(new Error('Conexión temporal'));
    await expect(resolveProjectChatSpace(input)).rejects.toThrow('Conexión');
    const abort = new AbortController(); abort.abort();
    await expect(resolveProjectChatSpace({ ...input, create: true, signal: abort.signal })).rejects.toThrow('cambió'); expect(writes).toHaveLength(0);
  });
});
