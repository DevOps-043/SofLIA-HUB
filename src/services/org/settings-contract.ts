import { z } from 'zod';
import type { SofiaContext } from '../sofia-auth';

const imageUrl = z.string().trim().max(2048).refine(value => {
  if (!value) return true;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
}, 'Usa una dirección HTTPS válida, sin credenciales.');

export const organizationSettingsSchema = z.object({
  name: z.string().trim().min(1, 'Escribe el nombre de la organización.').max(150),
  description: z.string().trim().max(2000),
  contact_email: z.string().trim().max(254).refine(value => !value || z.email().safeParse(value).success, 'Revisa el correo de contacto.'),
  contact_phone: z.string().trim().max(40),
  website_url: imageUrl,
  logo_url: imageUrl,
  brand_favicon_url: imageUrl,
  brand_color_primary: z.string().trim().refine(value => !value || /^#[\da-f]{6}$/i.test(value), 'Usa un color hexadecimal de seis dígitos.'),
  brand_color_secondary: z.string().trim().refine(value => !value || /^#[\da-f]{6}$/i.test(value), 'Usa un color hexadecimal de seis dígitos.'),
}).strict();

export type OrganizationSettings = z.infer<typeof organizationSettingsSchema>;
export const ORGANIZATION_ASSET_BUCKET = 'organization-branding';
export const ORGANIZATION_IMAGE_LIMIT = 2 * 1024 * 1024;

export function canManageOrganization(context: SofiaContext | null, userId?: string): boolean {
  const org = context?.currentOrganization;
  const actorId = userId || context?.user?.id;
  return Boolean(org?.is_active && actorId && context?.memberships.some(m =>
    m.organization_id === org.id && m.user_id === actorId && m.status === 'active' && (m.role === 'owner' || m.role === 'admin')));
}

export async function validateOrganizationImage(file: File): Promise<'png' | 'jpg' | 'webp'> {
  if (!file.size || file.size > ORGANIZATION_IMAGE_LIMIT) throw new Error('La imagen debe pesar como máximo 2 MB.');
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte);
  const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  if (png && file.type === 'image/png') return 'png';
  if (jpg && file.type === 'image/jpeg') return 'jpg';
  if (webp && file.type === 'image/webp') return 'webp';
  throw new Error('Selecciona una imagen PNG, JPEG o WebP válida.');
}
