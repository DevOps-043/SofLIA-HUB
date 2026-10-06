import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrgMembersError, orgService } from '../../services/org-service';

const sofia = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock('../../lib/sofia-client', () => ({ sofiaSupa: sofia }));

const row = {
  id: 'm-1', organization_id: 'org-1', user_id: 'u-1', role: 'admin', status: 'active',
  job_title: null, team_id: null, joined_at: '2026-01-01T00:00:00', created_at: '2026-01-01T00:00:00',
  username: 'ana', email: 'ana@soflia.ai', display_name: 'Ana', first_name: 'Ana', last_name: 'Pérez',
  profile_picture_url: null,
};

describe('miembros de la organización', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('ORG-001: usa la función acotada en lugar de leer public.users', async () => {
    sofia.rpc.mockResolvedValue({ data: [row], error: null });

    const members = await orgService.getOrganizationMembers('org-1');

    expect(sofia.rpc).toHaveBeenCalledWith('get_desktop_organization_members', { p_organization_id: 'org-1' });
    expect(sofia.from).not.toHaveBeenCalled();
    expect(members).toEqual([expect.objectContaining({
      id: 'm-1', role: 'admin', status: 'active',
      user_profile: expect.objectContaining({ id: 'u-1', username: 'ana', email: 'ana@soflia.ai', display_name: 'Ana' }),
    })]);
    // Sólo el perfil mínimo: nada de teléfono ni otros datos personales.
    expect(members[0].user_profile).not.toHaveProperty('phone');
  });

  it('una membresía sin fila en public.users se muestra sin perfil', async () => {
    sofia.rpc.mockResolvedValue({ data: [{ ...row, username: null, email: null, display_name: null }], error: null });
    expect((await orgService.getOrganizationMembers('org-1'))[0].user_profile).toBeUndefined();
  });

  it('ORG-002: explica que falta la actualización de SOFIA si la función no existe', async () => {
    sofia.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } });
    const failure = orgService.getOrganizationMembers('org-1');
    await expect(failure).rejects.toBeInstanceOf(OrgMembersError);
    await expect(failure).rejects.toThrow(/SOFIA aún no tiene la actualización/);
  });

  it('un rechazo de permisos no filtra el detalle técnico a la interfaz', async () => {
    sofia.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied for table users' } });
    await expect(orgService.getOrganizationMembers('org-1')).rejects.toThrow('No se pudieron cargar los miembros de la organización.');
  });
});
