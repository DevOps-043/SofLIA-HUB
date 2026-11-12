import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { OrganizationSettingsSection } from '../../components/unified-settings/sections/OrganizationSettingsSection';
import { getSettingsTabs } from '../../components/unified-settings/settings-tabs';
import { mergeOrganizationProfile } from '../../services/org/settings-context';
import type { SofiaContext } from '../../services/sofia-auth';
const mock = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn(), update: vi.fn() }));
vi.mock('../../services/org/settings', () => ({ getOrganizationSettings: mock.get, saveOrganizationSettings: mock.save }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ updateOrganizationProfile: mock.update }) }));
const values = { name: 'Empresa', description: '', contact_email: '', contact_phone: '', website_url: '', logo_url: '', brand_favicon_url: '', brand_color_primary: '', brand_color_secondary: '' };
function context(role: 'owner' | 'admin' | 'member' = 'admin', status: 'active' | 'suspended' = 'active', orgId = 'org'): SofiaContext {
  const org = { id: orgId, name: 'Empresa', slug: 'empresa', is_active: true, created_at: '' };
  const memberships = [{ id: 'm', organization_id: orgId, user_id: 'sofia-user', role, status }];
  return { currentOrganization: org, currentTeam: null, organizations: [org], teams: [], memberships,
    user: { id: 'sofia-user', username: 'admin', email: 'admin@example.test', full_name: 'Ana', organizations: [org], teams: [], memberships } };
}
describe('Administración de organización', () => {
  beforeEach(() => { vi.clearAllMocks(); mock.get.mockResolvedValue(values); mock.save.mockResolvedValue({ ...values, name: 'Nueva empresa' }); });
  it.each(['owner', 'admin'] as const)('ofrece navegación y formulario para %s activo', async role => {
    expect(getSettingsTabs(context(role)).find(tab => tab.id === 'organization')?.hidden).toBe(false);
    render(<OrganizationSettingsSection sofiaContext={context(role)} />);
    expect(await screen.findByLabelText('Nombre de la organización')).toHaveValue('Empresa');
    expect(screen.getByLabelText('Subir icono')).toBeInTheDocument();
  });
  it.each([context('member'), context('admin', 'suspended'), null])('deniega sin cargar datos a actores sin administración', ctx => {
    expect(getSettingsTabs(ctx).find(tab => tab.id === 'organization')?.hidden).toBe(true);
    render(<OrganizationSettingsSection sofiaContext={ctx} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/Solo los propietarios/);
    expect(mock.get).not.toHaveBeenCalled();
  });
  it('guarda explícitamente y actualiza el contexto usando la identidad SOFIA', async () => {
    render(<OrganizationSettingsSection sofiaContext={context()} />);
    fireEvent.change(await screen.findByLabelText('Nombre de la organización'), { target: { value: 'Nueva empresa' } });
    expect(mock.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await screen.findByText('Cambios guardados.');
    expect(mock.update).toHaveBeenCalledWith(expect.objectContaining({ name: 'Nueva empresa', id: 'org' }), 'sofia-user');
  });
  it('permite reintentar una carga fallida y no oculta el error', async () => {
    mock.get.mockRejectedValueOnce(new Error('Servicio no disponible.'));
    render(<OrganizationSettingsSection sofiaContext={context()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Servicio no disponible.');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByLabelText('Nombre de la organización')).toHaveValue('Empresa');
  });
  it('descarta una confirmación tardía al cambiar de organización', async () => {
    let finish!: (value: typeof values) => void;
    mock.save.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const { rerender } = render(<OrganizationSettingsSection sofiaContext={context()} />);
    fireEvent.change(await screen.findByLabelText('Nombre de la organización'), { target: { value: 'Anterior' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(mock.save).toHaveBeenCalledOnce());
    rerender(<OrganizationSettingsSection sofiaContext={context('admin', 'active', 'otra')} />);
    await act(async () => { finish({ ...values, name: 'Anterior' }); });
    expect(mock.update).not.toHaveBeenCalled();
    expect(await screen.findByLabelText('Nombre de la organización')).toHaveValue('Empresa');
  });
  it('no cambia selección ni acepta una actualización de otra sesión', () => {
    const ctx = context();
    const updated = { ...ctx.currentOrganization!, name: 'Actualizada' };
    expect(mergeOrganizationProfile(ctx, updated, 'otra-persona')).toBe(ctx);
    expect(mergeOrganizationProfile(null, updated, 'sofia-user')).toBeNull();
    const switched = { ...ctx, currentOrganization: { ...updated, id: 'otra', name: 'Otra' } };
    const result = mergeOrganizationProfile(switched, updated, 'sofia-user');
    expect(result?.currentOrganization?.name).toBe('Otra');
    expect(result?.organizations[0].name).toBe('Actualizada');
  });
});
