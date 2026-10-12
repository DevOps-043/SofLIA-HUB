import { getAuthState } from '../main/auth-state';
import { getOrganizationContext } from '../main/organization-context';
import { getSofiaSessionUserId, isSofiaMainSessionConfigured } from '../main/sofia-session';
import { getSofiaClient } from '../iris/clients';
import { resolveOrganizationBranding } from './service';
import { fetchBrandAsset } from './assets';
import { normalizeDocumentLogo } from './document-logo';
import { ensureContrast, extractPaletteFromBgra, hasCustomBrandColors, parseHex, toHex } from './palette';
import type { DocumentBranding, PreparedDocumentBranding } from '../../src/shared/document-branding';

type Preparation = { scope?: { userId: string; organizationId: string | null }; disabled?: boolean; guard?: () => Promise<void> };
const WHITE = { r: 255, g: 255, b: 255 };

/** La organización viene de un scope verificado o selección host; nunca del modelo. */
export async function prepareOrganizationDocument(input: Preparation = {}): Promise<PreparedDocumentBranding> {
  const selection = getOrganizationContext();
  const userId = input.scope?.userId ?? getAuthState().userId;
  let organizationId = input.scope ? input.scope.organizationId : selection.userId === userId ? selection.organizationId : null;
  const assertActor = async () => {
    const actor = getAuthState(); const current = getOrganizationContext();
    if (!userId || !actor.authenticated || actor.userId !== userId
      || (isSofiaMainSessionConfigured() && getSofiaSessionUserId() !== userId)
      || (current.userId !== null && current.userId !== userId)
      || (!input.scope && current.revision !== selection.revision)) throw new Error('La sesión o la organización cambiaron. Vuelve a generar el documento.');
    await input.guard?.();
  };
  await assertActor();
  const result = (notice: string | null, brand?: DocumentBranding): PreparedDocumentBranding => ({ brand, notice, assertCurrent });
  const client = getSofiaClient();
  async function membership(): Promise<'active' | 'unavailable'> {
    if (!client || !organizationId) return 'unavailable';
    const { data, error } = await client.from('organization_users').select('organization_id').eq('user_id', userId!)
      .eq('organization_id', organizationId).eq('status', 'active').limit(1).abortSignal(AbortSignal.timeout(8_000)).maybeSingle();
    await assertActor();
    if (error) return 'unavailable';
    if (!data) throw new Error('No tienes acceso a la organización del documento.');
    return 'active';
  }
  async function assertCurrent() {
    await assertActor();
    // Una marca ya preparada no se publica si la membresía dejó de ser verificable.
    if (organizationId && client && await membership() !== 'active') throw new Error('No se pudo verificar la organización antes de guardar.');
    await assertActor();
  }
  if (input.disabled) return result(null);
  const fallback = 'Se usó el diseño editorial porque la identidad de la organización no está disponible.';
  if (!client) return result(fallback);
  if (!organizationId && !input.scope && !selection.organizationId) {
    try {
      const { data, error } = await client.from('organization_users').select('organization_id').eq('user_id', userId!)
        .eq('status', 'active').limit(2).abortSignal(AbortSignal.timeout(8_000));
      await assertActor();
      const ids = !error && Array.isArray(data) ? [...new Set(data.map(row => String(row.organization_id)))] : [];
      if (ids.length === 1) organizationId = ids[0];
    } catch { await assertActor(); return result(fallback); }
  }
  if (!organizationId) return result(fallback);
  // Los errores de permisos no se convierten en un fallback silencioso.
  let status: 'active' | 'unavailable';
  try { status = await membership(); } catch (error) {
    await assertActor();
    if (error instanceof Error && error.message.startsWith('No tienes acceso')) throw error;
    organizationId = null; return result(fallback);
  }
  if (status !== 'active') { organizationId = null; return result(fallback); }
  const branding = await resolveOrganizationBranding(organizationId);
  await assertActor();
  if (!branding.enabled) return result(fallback);
  let logo: DocumentBranding['logo'];
  if (branding.logoUrl) {
    try {
      const asset = await fetchBrandAsset(branding.logoUrl, { storageOnly: true });
      await assertActor(); logo = await normalizeDocumentLogo(asset.buffer);
    } catch { await assertActor(); }
  }
  let palette = { primary: branding.colorPrimary, secondary: branding.colorSecondary, accent: branding.colorAccent };
  if (logo && !hasCustomBrandColors(Object.values(palette))) {
    const sharp = (await import('sharp')).default;
    const { data, info } = await sharp(logo.png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let pixel = 0; pixel < data.length; pixel += 4) { const red = data[pixel]; data[pixel] = data[pixel + 2]; data[pixel + 2] = red; }
    const extracted = extractPaletteFromBgra(data, info.width, info.height);
    if (extracted) palette = extracted;
  }
  const color = (value: string, defaultValue: string, text = false) => {
    const compact = /^#([\da-f]{3})$/i.exec(value);
    const normalized = compact ? '#' + [...compact[1]].map(channel => channel + channel).join('') : /^#[\da-f]{8}$/i.test(value) ? value.slice(0, 7) : value;
    const parsed = parseHex(normalized) ?? parseHex(defaultValue)!;
    return toHex(text ? ensureContrast(parsed, WHITE) : parsed).slice(1).toUpperCase();
  };
  const font = branding.fontFamily.match(/^'?([\w -]{1,40})'?\s*(?:,|$)/)?.[1];
  const brand: DocumentBranding = {
    organizationName: (branding.organizationName ?? 'Organización').slice(0, 200),
    primary: color(palette.primary, '#0A2540', true), secondary: color(palette.secondary, '#13263B', true),
    accent: color(palette.accent, '#23AEA8'), fontFamily: font, logo,
  };
  await assertActor();
  return result(logo ? null : 'Se aplicaron los colores corporativos; el logo no está disponible.', brand);
}
