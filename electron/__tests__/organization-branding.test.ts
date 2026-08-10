import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadBrandAssets, isAllowedBrandingUrl } from '../organization-branding/assets';
import { buildBrandCss } from '../organization-branding/brand-css';
import { invalidateBrandingCache, resolveOrganizationBranding } from '../organization-branding/service';
import { NEUTRAL_BRANDING, type OrganizationBranding } from '../organization-branding/types';

const maybeSingle = vi.fn();
const eq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));
const getSofiaClient = vi.fn(() => ({ from }) as never);

vi.mock('../iris/clients', () => ({
  getSofiaClient: () => getSofiaClient(),
}));

const HOST_PERMITIDO = 'proyecto.supabase.co';

function filaOrganizacion(overrides: Record<string, unknown> = {}) {
  return {
    id: 'org-1',
    name: 'Acme',
    branding_enabled: true,
    brand_color_primary: '#123456',
    brand_color_secondary: '#654321',
    brand_color_accent: '#abcdef',
    brand_font_family: 'Inter',
    brand_logo_url: `https://${HOST_PERMITIDO}/storage/logo.png`,
    brand_favicon_url: null,
    brand_banner_url: null,
    logo_url: null,
    ...overrides,
  };
}

describe('resolucion de la identidad de la organizacion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateBrandingCache();
    maybeSingle.mockResolvedValue({ data: filaOrganizacion(), error: null });
  });

  it('devuelve el tema neutro sin organizacion', async () => {
    const branding = await resolveOrganizationBranding(null);

    expect(branding.enabled).toBe(false);
    expect(branding.colorPrimary).toBe(NEUTRAL_BRANDING.colorPrimary);
    expect(from).not.toHaveBeenCalled();
  });

  it('aplica la identidad cuando el branding esta habilitado', async () => {
    const branding = await resolveOrganizationBranding('org-1');

    expect(branding.enabled).toBe(true);
    expect(branding.colorPrimary).toBe('#123456');
    expect(branding.fontFamily).toContain("'Inter'");
  });

  it('devuelve el tema neutro cuando el branding esta deshabilitado', async () => {
    maybeSingle.mockResolvedValue({ data: filaOrganizacion({ branding_enabled: false }), error: null });

    const branding = await resolveOrganizationBranding('org-1');

    expect(branding.enabled).toBe(false);
    expect(branding.colorPrimary).toBe(NEUTRAL_BRANDING.colorPrimary);
    expect(branding.organizationName).toBe('Acme');
  });

  it('completa con el tema neutro cuando falta un color', async () => {
    maybeSingle.mockResolvedValue({ data: filaOrganizacion({ brand_color_secundario: null, brand_color_secondary: null }), error: null });

    const branding = await resolveOrganizationBranding('org-1');

    expect(branding.colorSecondary).toBe(NEUTRAL_BRANDING.colorSecondary);
  });

  it('rechaza un color que no tiene forma de color CSS', async () => {
    maybeSingle.mockResolvedValue({
      data: filaOrganizacion({ brand_color_primary: 'red; } body { display: none } .x {' }),
      error: null,
    });

    const branding = await resolveOrganizationBranding('org-1');

    expect(branding.colorPrimary).toBe(NEUTRAL_BRANDING.colorPrimary);
  });

  it('no expone datos que no sean de presentacion', async () => {
    await resolveOrganizationBranding('org-1');

    const columnas = String((select.mock.calls[0] as unknown[] | undefined)?.[0] ?? '');
    expect(columnas).not.toContain('subscription');
    expect(columnas).not.toContain('contact_email');
    expect(columnas).not.toContain('max_users');
  });

  it('reutiliza la identidad cacheada en una segunda generacion', async () => {
    await resolveOrganizationBranding('org-1');
    await resolveOrganizationBranding('org-1');

    expect(from).toHaveBeenCalledTimes(1);
  });

  it('vuelve a consultar tras invalidar por cambio de organizacion', async () => {
    await resolveOrganizationBranding('org-1');
    invalidateBrandingCache('org-1');
    await resolveOrganizationBranding('org-1');

    expect(from).toHaveBeenCalledTimes(2);
  });

  it('descarta toda la cache al cerrar sesion', async () => {
    await resolveOrganizationBranding('org-1');
    invalidateBrandingCache();
    await resolveOrganizationBranding('org-1');

    expect(from).toHaveBeenCalledTimes(2);
  });

  it('cae al tema neutro si la consulta falla', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: 'sin conexion' } });

    const branding = await resolveOrganizationBranding('org-1');

    expect(branding.enabled).toBe(false);
  });
});

describe('descarga de recursos de marca', () => {
  let workspace: string;

  const branding: OrganizationBranding = {
    ...NEUTRAL_BRANDING,
    organizationId: 'org-1',
    enabled: true,
    logoUrl: `https://${HOST_PERMITIDO}/storage/logo.png`,
    bannerUrl: null,
  };

  beforeEach(async () => {
    workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'brand-'));
  });

  afterEach(async () => {
    await fs.rm(workspace, { recursive: true, force: true });
  });

  function respuestaImagen(bytes: number) {
    return {
      ok: true,
      headers: new Headers({ 'content-type': 'image/png', 'content-length': String(bytes) }),
      arrayBuffer: async () => new ArrayBuffer(bytes),
    } as unknown as Response;
  }

  it('descarga un recurso del origen permitido', async () => {
    const fetchImpl = vi.fn(async () => respuestaImagen(1024));

    const assets = await downloadBrandAssets(workspace, branding, { fetchImpl, allowedHost: HOST_PERMITIDO });

    expect(assets.logo).toBe('assets/logo.png');
    expect(assets.missing).toHaveLength(0);
  });

  it('rechaza un origen no permitido sin descargar', async () => {
    const fetchImpl = vi.fn(async () => respuestaImagen(1024));
    const externo = { ...branding, logoUrl: 'https://atacante.example.com/logo.png' };

    const assets = await downloadBrandAssets(workspace, externo, { fetchImpl, allowedHost: HOST_PERMITIDO });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(assets.logo).toBeNull();
    expect(assets.missing).toContain('logo');
  });

  it('rechaza un recurso que supera el limite de tamano', async () => {
    const fetchImpl = vi.fn(async () => respuestaImagen(5 * 1024 * 1024));

    const assets = await downloadBrandAssets(workspace, branding, { fetchImpl, allowedHost: HOST_PERMITIDO });

    expect(assets.logo).toBeNull();
    expect(assets.missing).toContain('logo');
  });

  it('trata el timeout como recurso ausente sin lanzar', async () => {
    const fetchImpl = vi.fn(async () => {
      throw Object.assign(new Error('abortado'), { name: 'AbortError' });
    });

    const assets = await downloadBrandAssets(workspace, branding, { fetchImpl, allowedHost: HOST_PERMITIDO });

    expect(assets.logo).toBeNull();
    expect(assets.missing).toContain('logo');
  });

  it('rechaza un tipo de contenido que no es imagen conocida', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      headers: new Headers({ 'content-type': 'text/html' }),
      arrayBuffer: async () => new ArrayBuffer(64),
    }) as unknown as Response);

    const assets = await downloadBrandAssets(workspace, branding, { fetchImpl, allowedHost: HOST_PERMITIDO });

    expect(assets.logo).toBeNull();
  });

  it('no descarga nada cuando el branding esta deshabilitado', async () => {
    const fetchImpl = vi.fn(async () => respuestaImagen(1024));

    const assets = await downloadBrandAssets(workspace, { ...branding, enabled: false }, { fetchImpl, allowedHost: HOST_PERMITIDO });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(assets.logo).toBeNull();
  });

  it('rechaza http y subdominios que solo comparten sufijo', () => {
    expect(isAllowedBrandingUrl(`http://${HOST_PERMITIDO}/logo.png`, HOST_PERMITIDO)).toBe(false);
    expect(isAllowedBrandingUrl(`https://${HOST_PERMITIDO}.atacante.com/logo.png`, HOST_PERMITIDO)).toBe(false);
    expect(isAllowedBrandingUrl(`https://${HOST_PERMITIDO}/logo.png`, HOST_PERMITIDO)).toBe(true);
    expect(isAllowedBrandingUrl(`https://${HOST_PERMITIDO}/logo.png`, null)).toBe(false);
  });
});

describe('hoja de variables de marca', () => {
  it('declara las variables con los colores de la organizacion', () => {
    const css = buildBrandCss(
      { ...NEUTRAL_BRANDING, enabled: true, colorPrimary: '#123456' },
      { logo: 'assets/logo.png', banner: null, missing: [] },
    );

    expect(css).toContain('--marca-color-primario: #123456');
    expect(css).toContain("--marca-logo: url('assets/logo.png')");
    expect(css).toContain('--marca-banner: none');
  });

  it('usa el tema neutro cuando el branding esta deshabilitado', () => {
    const css = buildBrandCss(NEUTRAL_BRANDING, { logo: null, banner: null, missing: [] });

    expect(css).toContain('Tema neutro');
    expect(css).toContain(`--marca-color-primario: ${NEUTRAL_BRANDING.colorPrimary}`);
  });

  it('no permite cerrar el comentario desde el nombre de la organizacion', () => {
    const css = buildBrandCss(
      { ...NEUTRAL_BRANDING, enabled: true, organizationName: 'Acme */ body { display: none } /*' },
      { logo: null, banner: null, missing: [] },
    );

    const encabezado = css.slice(0, css.indexOf(':root'));
    expect(encabezado).not.toContain('*/ body');
  });
});
