import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { getAuthState, setAuthState } from '../main/auth-state';
import { getOrganizationContext, setOrganizationContext } from '../main/organization-context';
import { prepareOrganizationDocument } from '../organization-branding/document-branding';
import { fetchBrandAsset } from '../organization-branding/assets';
import { normalizeDocumentLogo } from '../organization-branding/document-logo';

const mocks = vi.hoisted(() => ({ from: vi.fn(), resolve: vi.fn(), sessionUser: 'usuario' }));
vi.mock('../sofia/clients', () => ({ getSofiaClient: () => ({ from: mocks.from }) }));
vi.mock('../organization-branding/service', () => ({ resolveOrganizationBranding: mocks.resolve }));
vi.mock('../main/sofia-session', () => ({ isSofiaMainSessionConfigured: () => true, getSofiaSessionUserId: () => mocks.sessionUser }));

let png: Buffer;
let membership: { data: unknown; error: unknown };
let memberships: string[];
const organization = { enabled: true, organizationName: 'Organización de prueba', colorPrimary: '#0A2540', colorSecondary: '#13263B', colorAccent: '#23AEA8', fontFamily: "'Arial', sans-serif", logoUrl: 'https://prueba.supabase.co/storage/v1/object/public/logos/logo.png' };
beforeEach(async () => {
  vi.clearAllMocks(); mocks.sessionUser = 'usuario';
  setAuthState({ authenticated: true, userId: 'usuario' }); setOrganizationContext('usuario', 'organizacion');
  vi.stubEnv('VITE_SOFIA_SUPABASE_URL', 'https://prueba.supabase.co');
  png = await sharp({ create: { width: 64, height: 32, channels: 4, background: '#23aea8' } }).png().toBuffer();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(png), { headers: { 'content-type': 'image/png' } })));
  membership = { data: { organization_id: 'organizacion' }, error: null }; memberships = ['organizacion'];
  mocks.from.mockImplementation(() => {
    const query = { select: vi.fn(() => query), eq: vi.fn(() => query), limit: vi.fn(() => query), abortSignal: vi.fn(() => query), maybeSingle: vi.fn(async () => membership),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: memberships.map(organization_id => ({ organization_id })), error: null }).then(resolve) };
    return query;
  });
  mocks.resolve.mockResolvedValue(organization);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('Marca corporativa de documentos', () => {
  it('deriva colores del logo cuando Learning conserva la paleta de fábrica', async () => {
    mocks.resolve.mockResolvedValue({ ...organization, colorPrimary: '#3b82f6', colorSecondary: '#10b981', colorAccent: '#8b5cf6' });
    const result = await prepareOrganizationDocument();
    expect(result.brand?.primary).not.toBe('3B82F6'); expect(result.brand?.accent).not.toBe('8B5CF6');
    expect(result.brand?.logo).toBeDefined();
  });
  it('resuelve membresía y logo normalizado sin entregar URL al generador', async () => {
    const result = await prepareOrganizationDocument();
    expect(result.brand).toMatchObject({ primary: '0A2540', accent: '23AEA8', organizationName: organization.organizationName });
    expect(result.brand?.logo).toMatchObject({ width: 64, height: 32 });
    expect(JSON.stringify(result.brand)).not.toContain('https://');
    expect(result.notice).toBeNull(); await result.assertCurrent();
    expect(mocks.resolve).toHaveBeenCalledWith('organizacion');
    expect(fetch).toHaveBeenCalledWith(organization.logoUrl, expect.objectContaining({ redirect: 'error', signal: expect.any(AbortSignal) }));
  });
  it('no escoge arbitrariamente una organización entre varias membresías', async () => {
    setOrganizationContext('usuario', null); memberships = ['una', 'otra'];
    const result = await prepareOrganizationDocument();
    expect(result.brand).toBeUndefined(); expect(result.notice).toContain('editorial'); expect(fetch).not.toHaveBeenCalled();
  });
  it('rechaza una organización sin membresía antes de consultar marca o descargar', async () => {
    membership.data = null;
    await expect(prepareOrganizationDocument()).rejects.toThrow('No tienes acceso');
    expect(mocks.resolve).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  it('no prepara documentos con el actor anterior durante un cambio de cuenta pendiente', async () => {
    setOrganizationContext('otra-cuenta', 'organizacion');
    await expect(prepareOrganizationDocument()).rejects.toThrow('cambiaron');
    expect(mocks.from).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  it('conserva colores y avisa cuando el logo falla', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('', { status: 404 }));
    const result = await prepareOrganizationDocument();
    expect(result.brand?.primary).toBe('0A2540'); expect(result.brand?.logo).toBeUndefined(); expect(result.notice).toContain('logo');
  });
  it('rechaza un cambio de selección durante descarga y antes de guardar', async () => {
    vi.mocked(fetch).mockImplementationOnce(async () => {
      setOrganizationContext('usuario', 'otra');
      return new Response(new Uint8Array(png), { headers: { 'content-type': 'image/png' } });
    });
    await expect(prepareOrganizationDocument()).rejects.toThrow('cambiaron');
    setOrganizationContext('usuario', 'organizacion');
    const prepared = await prepareOrganizationDocument();
    setOrganizationContext('usuario', 'otra'); setOrganizationContext('usuario', 'organizacion');
    await expect(prepared.assertCurrent()).rejects.toThrow('cambiaron');
  });
  it('revalida sesión y membresía para una marca preparada', async () => {
    const prepared = await prepareOrganizationDocument();
    membership.data = null; await expect(prepared.assertCurrent()).rejects.toThrow('No tienes acceso');
    membership.data = { organization_id: 'organizacion' };
    setAuthState({ authenticated: false, userId: null }); await expect(prepared.assertCurrent()).rejects.toThrow('cambiaron');
    expect(getAuthState().authenticated).toBe(false);
  });
  it('permite omitir marca sin descargar, conservando la guarda de actor', async () => {
    const prepared = await prepareOrganizationDocument({ disabled: true });
    expect(prepared.brand).toBeUndefined(); expect(fetch).not.toHaveBeenCalled();
    setOrganizationContext('otro', null); await expect(prepared.assertCurrent()).rejects.toThrow();
    expect(getOrganizationContext().userId).toBe('otro');
  });
  it('usa diseño editorial ante error de consulta, sin ocultar cambios de sesión', async () => {
    mocks.from.mockImplementation(() => { throw new Error('Sin red'); });
    const prepared = await prepareOrganizationDocument();
    expect(prepared.notice).toContain('editorial'); await prepared.assertCurrent();
  });
  it('deniega host ajeno, credenciales, ruta ajena a Storage y stream sobredimensionado', async () => {
    for (const url of ['https://otro.supabase.co/storage/v1/object/logo.png', 'https://usuario:clave@prueba.supabase.co/storage/v1/object/logo.png', 'https://prueba.supabase.co/rest/v1/organizations']) {
      await expect(fetchBrandAsset(url, { storageOnly: true })).rejects.toThrow('Origen');
    }
    expect(fetch).not.toHaveBeenCalled();
    const cancel = vi.fn();
    vi.mocked(fetch).mockResolvedValue(new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(2_097_153)); }, cancel }), { headers: { 'content-type': 'image/png' } }));
    await expect(fetchBrandAsset(organization.logoUrl, { storageOnly: true })).rejects.toThrow('grande'); expect(cancel).toHaveBeenCalled();
  });
  it('descarta SVG y contenido que finge ser PNG', async () => {
    await expect(normalizeDocumentLogo(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="5" height="5"/>'))).rejects.toThrow();
    await expect(normalizeDocumentLogo(Buffer.from('<html>error</html>'))).rejects.toThrow();
  });
});
