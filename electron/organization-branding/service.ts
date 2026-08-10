import { getSofiaClient } from '../iris/clients';
import { NEUTRAL_BRANDING, type OrganizationBranding } from './types';

/**
 * Resolucion de la identidad visual de una organizacion desde Supabase
 * SOFIA. Se resuelve en main porque el destino de los recursos es el disco
 * (el workspace de la Skill): pedirle al renderer que descargue y luego
 * mande bytes por IPC anadiria un salto sin ganancia.
 *
 * Devuelve SOLO datos de presentacion. Las columnas de suscripcion, contacto
 * y miembros no se seleccionan para que no puedan filtrarse al generador.
 */

/** Columnas de presentacion. Cualquier otra queda deliberadamente fuera. */
const BRANDING_COLUMNS =
  'id, name, branding_enabled, brand_color_primary, brand_color_secondary, brand_color_accent, brand_font_family, brand_logo_url, brand_favicon_url, brand_banner_url, logo_url';

/** Ventana de caché: cubre varias generaciones seguidas sin volver a consultar. */
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  branding: OrganizationBranding;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

export async function resolveOrganizationBranding(
  organizationId: string | null | undefined,
  options: { now?: number } = {},
): Promise<OrganizationBranding> {
  const id = String(organizationId ?? '').trim();
  if (!id) return NEUTRAL_BRANDING;

  const now = options.now ?? Date.now();
  const cached = cache.get(id);
  if (cached && cached.expiresAt > now) return cached.branding;

  const client = getSofiaClient();
  if (!client) {
    console.warn('[OrganizationBranding] SOFIA no esta configurado; se usa el tema neutro.');
    return NEUTRAL_BRANDING;
  }

  try {
    const { data, error } = await client
      .from('organizations')
      .select(BRANDING_COLUMNS)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[OrganizationBranding] Error al consultar la organizacion:', error.message);
      return NEUTRAL_BRANDING;
    }
    if (!data) return NEUTRAL_BRANDING;

    const branding = mapBranding(data as Record<string, unknown>);
    cache.set(id, { branding, expiresAt: now + CACHE_TTL_MS });
    return branding;
  } catch (error) {
    console.error('[OrganizationBranding] Fallo inesperado:', error);
    return NEUTRAL_BRANDING;
  }
}

/**
 * Invalida la caché. Se llama al cambiar de organizacion activa y al cerrar
 * sesion: los datos de una organizacion no deben sobrevivir a ninguno de los
 * dos eventos.
 */
export function invalidateBrandingCache(organizationId?: string | null): void {
  const id = String(organizationId ?? '').trim();
  if (id) cache.delete(id);
  else cache.clear();
}

/**
 * Organizacion activa de un usuario. El proceso main solo conoce el `userId`
 * (ver `electron/main/auth-state.ts`), asi que las superficies sin renderer
 * —como WhatsApp— necesitan resolverla aqui para aplicar la identidad.
 */
export async function resolveUserOrganizationId(userId: string | null | undefined): Promise<string | null> {
  const id = String(userId ?? '').trim();
  if (!id) return null;

  const client = getSofiaClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('organization_users')
      .select('organization_id')
      .eq('user_id', id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return text((data as Record<string, unknown>).organization_id);
  } catch {
    return null;
  }
}

function mapBranding(row: Record<string, unknown>): OrganizationBranding {
  const enabled = row.branding_enabled === true;
  if (!enabled) {
    return {
      ...NEUTRAL_BRANDING,
      organizationId: text(row.id),
      organizationName: text(row.name),
    };
  }

  return {
    organizationId: text(row.id),
    organizationName: text(row.name),
    enabled: true,
    colorPrimary: color(row.brand_color_primary) ?? NEUTRAL_BRANDING.colorPrimary,
    colorSecondary: color(row.brand_color_secondary) ?? NEUTRAL_BRANDING.colorSecondary,
    colorAccent: color(row.brand_color_accent) ?? NEUTRAL_BRANDING.colorAccent,
    fontFamily: fontFamily(row.brand_font_family),
    // `logo_url` es el campo historico; `brand_logo_url` el del sistema de
    // marca. Se prefiere el segundo y el primero queda como respaldo.
    logoUrl: text(row.brand_logo_url) ?? text(row.logo_url),
    faviconUrl: text(row.brand_favicon_url),
    bannerUrl: text(row.brand_banner_url),
    missingAssets: [],
    colorSource: 'declarado',
  };
}

function text(value: unknown): string | null {
  const raw = String(value ?? '').trim();
  return raw ? raw : null;
}

/**
 * Acepta solo colores CSS con forma conocida. Un valor libre entraria tal
 * cual en la hoja de estilos y podria cerrar la declaracion e inyectar
 * reglas arbitrarias.
 */
function color(value: unknown): string | null {
  const raw = String(value ?? '').trim();
  if (/^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$|^#[0-9a-fA-F]{8}$/.test(raw)) return raw;
  if (/^rgba?\(\s*[\d.\s,%]+\)$/.test(raw)) return raw;
  if (/^hsla?\(\s*[\d.\s,%deg]+\)$/.test(raw)) return raw;
  return null;
}

/**
 * La tipografia se limita a un nombre simple y se envuelve en comillas; la
 * pila de respaldo la pone el sistema para que la presentacion renderice sin
 * conexion aunque la fuente de marca no este instalada.
 */
function fontFamily(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw || !/^[\w\s-]{1,40}$/.test(raw)) return NEUTRAL_BRANDING.fontFamily;
  return `'${raw}', ${NEUTRAL_BRANDING.fontFamily}`;
}
