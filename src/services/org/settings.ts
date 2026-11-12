import { sofiaSupa } from '../../lib/sofia-client';
import { ORGANIZATION_ASSET_BUCKET, organizationSettingsSchema, validateOrganizationImage, type OrganizationSettings } from './settings-contract';

const fields = Object.keys(organizationSettingsSchema.shape) as (keyof OrganizationSettings)[];

function settingsError(code?: string): Error {
  if (code === 'PGRST202' || code === '42883') return new Error('La administración de la organización aún no está habilitada. Contacta al administrador de la plataforma e inténtalo de nuevo.');
  if (code === '42501' || code === 'PGRST301') return new Error('Tu sesión no tiene permiso para administrar esta organización.');
  return new Error('No se pudo confirmar la operación. Revisa la conexión y vuelve a cargar los datos antes de reintentar.');
}

async function requestSettings(organizationId: string, changes: OrganizationSettings | null) {
  if (!sofiaSupa) throw new Error('SOFIA no está disponible.');
  const { data, error } = await sofiaSupa.rpc('desktop_organization_settings', { p_organization_id: organizationId, p_changes: changes });
  if (error) throw settingsError(error.code);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('La organización no devolvió sus ajustes.');
  const record = data as Record<string, unknown>;
  const normalized = Object.fromEntries(fields.map(key => [key, record[key] ?? '']));
  // La lectura conserva enlaces antiguos; los datos escritos sí pasan validación estricta.
  if (fields.some(key => typeof normalized[key] !== 'string')) throw new Error('Los ajustes recibidos no son válidos.');
  return normalized as OrganizationSettings;
}

export const getOrganizationSettings = (organizationId: string) => requestSettings(organizationId, null);

export async function saveOrganizationSettings(
  organizationId: string,
  input: OrganizationSettings,
  images: { logo?: File; icon?: File } = {},
  isCurrent: () => boolean = () => true,
): Promise<OrganizationSettings> {
  const values = organizationSettingsSchema.parse(input);
  if (!sofiaSupa) throw new Error('SOFIA no está disponible.');
  const assertCurrent = () => { if (!isCurrent()) throw new Error('La selección cambió. Vuelve a abrir los ajustes de la organización.'); };
  assertCurrent();
  // La RPC confirma que el contrato está desplegado y la membresía sigue vigente antes de subir.
  await getOrganizationSettings(organizationId);
  assertCurrent();
  for (const kind of ['logo', 'icon'] as const) {
    const file = images[kind];
    if (!file) continue;
    const extension = await validateOrganizationImage(file);
    assertCurrent();
    const path = `${organizationId}/${kind}/${crypto.randomUUID()}.${extension}`;
    const bucket = sofiaSupa.storage.from(ORGANIZATION_ASSET_BUCKET);
    const { error } = await bucket.upload(path, file, { contentType: file.type, upsert: false, cacheControl: '3600' });
    if (error) throw new Error('No se pudo confirmar la carga de la imagen. Revisa la conexión y vuelve a cargar los ajustes.');
    assertCurrent();
    values[kind === 'logo' ? 'logo_url' : 'brand_favicon_url'] = bucket.getPublicUrl(path).data.publicUrl;
  }
  assertCurrent();
  // No se borran cargas tras un timeout: la confirmación puede haberse perdido después del commit.
  return requestSettings(organizationId, values);
}
