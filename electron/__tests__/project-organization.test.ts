import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { resolveProjectOrganization } from '../project-hub/organization';
import type { ProjectHubApiService } from '../project-hub/service';

const lookup = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn(), eq: vi.fn(), in: vi.fn(), limit: vi.fn(), abortSignal: vi.fn() }));
vi.mock('../iris/clients', () => ({ getIrisClient: () => ({ from: lookup.from }) }));
const org = randomUUID(), workspace = randomUUID(), other = randomUUID();
const auth = { userId: 'usuario-qa', assertCurrent: vi.fn(), signal: new AbortController().signal };
const service = { getStatus: vi.fn() };
function setup(data: unknown) {
  vi.clearAllMocks();
  service.getStatus.mockResolvedValue({ enabled: true, authenticated: true, workspaces: [{ id: workspace, name: 'Mismo nombre', role: 'owner' }, { id: other, name: 'Mismo nombre', role: 'member' }] });
  for (const method of ['from', 'select', 'eq', 'in', 'limit'] as const) lookup[method].mockReturnValue(lookup);
  lookup.abortSignal.mockResolvedValue({ data, error: null });
}
describe('Organización activa y workspace autorizado', () => {
  it('resuelve por ID de organización y restringe la consulta a la sesión', async () => {
    setup([{ workspace_id: workspace }]);
    expect(await resolveProjectOrganization(service as unknown as ProjectHubApiService, org, auth)).toEqual({ workspaceId: workspace, name: 'Mismo nombre', role: 'owner' });
    expect(lookup.select).toHaveBeenCalledWith('workspace_id');
    expect(lookup.eq).toHaveBeenCalledWith('sofia_org_id', org);
    expect(lookup.in).toHaveBeenCalledWith('workspace_id', [workspace, other]);
  });
  it.each([[], [{ workspace_id: randomUUID() }], [{ workspace_id: workspace }, { workspace_id: other }]].map(data => ({ data })))('no usa el primer workspace ni nombres como fallback: %#', async ({ data }) => {
    setup(data);
    await expect(resolveProjectOrganization(service as unknown as ProjectHubApiService, org, auth)).rejects.toThrow();
  });
  it('sin sesión no consulta el directorio', async () => {
    setup([]); service.getStatus.mockResolvedValue({ authenticated: false, workspaces: [] });
    await expect(resolveProjectOrganization(service as unknown as ProjectHubApiService, org, auth)).rejects.toThrow();
    expect(lookup.from).not.toHaveBeenCalled();
  });
});
