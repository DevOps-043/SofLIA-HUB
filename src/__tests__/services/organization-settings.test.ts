import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { File as BinaryFile } from 'node:buffer';
import { getOrganizationSettings, saveOrganizationSettings } from '../../services/org/settings';
import { organizationSettingsSchema, validateOrganizationImage } from '../../services/org/settings-contract';

const mock = vi.hoisted(() => ({ rpc: vi.fn(), upload: vi.fn(), publicUrl: vi.fn() }));
vi.mock('../../lib/sofia-client', () => ({ sofiaSupa: { rpc: mock.rpc, storage: { from: () => ({ upload: mock.upload, getPublicUrl: mock.publicUrl }) } } }));
const values = { name: 'Empresa', description: '', contact_email: '', contact_phone: '', website_url: '', logo_url: '', brand_favicon_url: '', brand_color_primary: '', brand_color_secondary: '' };
const png = () => new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])], 'logo.png', { type: 'image/png' });

describe('Ajustes de organización: contrato y servicio', () => {
  beforeEach(() => { vi.stubGlobal('File', BinaryFile); vi.clearAllMocks(); mock.rpc.mockResolvedValue({ data: values, error: null }); mock.upload.mockResolvedValue({ error: null }); mock.publicUrl.mockReturnValue({ data: { publicUrl: 'https://example.test/logo.png' } }); });
  afterEach(() => vi.unstubAllGlobals());
  it('rechaza claves ajenas y enlaces con credenciales o protocolos inseguros', () => {
    for (const patch of [{ subscription_plan: 'enterprise' }, { logo_url: 'javascript:alert(1)' }, { website_url: 'https://usuario:clave@example.test' }, { name: '' }, { brand_color_primary: 'rojo' }]) {
      expect(organizationSettingsSchema.safeParse({ ...values, ...patch }).success).toBe(false);
    }
  });
  it('valida tipo, firma y límite de imágenes', async () => {
    await expect(validateOrganizationImage(png())).resolves.toBe('png');
    await expect(validateOrganizationImage(new File(['<svg/>'], 'logo.png', { type: 'image/png' }))).rejects.toThrow(/PNG/);
    await expect(validateOrganizationImage(new File([new Uint8Array(2097153)], 'logo.png', { type: 'image/png' }))).rejects.toThrow(/2 MB/);
  });
  it('distingue contrato no desplegado y denegación de permisos', async () => {
    mock.rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202' } });
    await expect(getOrganizationSettings('org')).rejects.toThrow(/aún no está habilitada/);
    mock.rpc.mockResolvedValueOnce({ data: null, error: { code: '42501' } });
    await expect(getOrganizationSettings('org')).rejects.toThrow(/permiso/);
  });
  it('carga sin sobrescribir archivos y guarda sólo después de autorizar', async () => {
    await saveOrganizationSettings('org', values, { logo: png() });
    expect(mock.rpc.mock.calls[0][1]).toEqual({ p_organization_id: 'org', p_changes: null });
    expect(mock.upload).toHaveBeenCalledWith(expect.stringMatching(/^org\/logo\/.+\.png$/), expect.any(File), expect.objectContaining({ upsert: false }));
    expect(mock.rpc.mock.calls[1][1].p_changes.logo_url).toBe('https://example.test/logo.png');
  });
  it('no sube ni guarda si se revoca el permiso o cambia el ámbito', async () => {
    mock.rpc.mockResolvedValueOnce({ data: null, error: { code: '42501' } });
    await expect(saveOrganizationSettings('org', values, { logo: png() })).rejects.toThrow(/permiso/);
    expect(mock.upload).not.toHaveBeenCalled();
    await expect(saveOrganizationSettings('org', values, {}, () => false)).rejects.toThrow(/selección cambió/);
    expect(mock.rpc).toHaveBeenCalledTimes(1);
  });
  it('detiene el guardado tras una carga si cambia la selección', async () => {
    let current = true;
    mock.upload.mockImplementationOnce(async () => { current = false; return { error: null }; });
    await expect(saveOrganizationSettings('org', values, { logo: png() }, () => current)).rejects.toThrow(/selección cambió/);
    expect(mock.rpc).toHaveBeenCalledTimes(1);
  });
  it('no afirma éxito ante timeout de escritura y permite leer estado real', async () => {
    mock.rpc.mockResolvedValueOnce({ data: values, error: null }).mockResolvedValueOnce({ data: null, error: { code: 'NETWORK' } });
    await expect(saveOrganizationSettings('org', values)).rejects.toThrow(/No se pudo confirmar/);
    await expect(getOrganizationSettings('org')).resolves.toEqual(values);
  });
});
