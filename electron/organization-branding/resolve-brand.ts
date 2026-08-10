import { downloadBrandAssets } from './assets';
import { buildBrandCss } from './brand-css';
import { DECK_BASE_CSS } from './deck-base-css';
import { DECK_BASE_JS } from './deck-base-js';
import { extractPaletteFromLogoFile } from './logo-colors';
import { ensureContrast, parseHex, toHex } from './palette';
import { resolveOrganizationBranding } from './service';
import type { LocalBrandAssets, OrganizationBranding } from './types';

/**
 * Resuelve la identidad completa de una organizacion para un workspace:
 * consulta, descarga de recursos, PALETA DERIVADA DEL LOGO y hoja CSS.
 *
 * Por que la paleta sale del logo: en la practica `brand_color_*` suele
 * quedarse con el azul por defecto mientras el logo si es el real. Tomar los
 * colores del propio logotipo hace que la presentacion se vea de la
 * organizacion sin pedirle a nadie que rellene una paleta a mano. Los valores
 * declarados siguen ganando cuando alguien los configuro de verdad.
 */

/** Fondo sobre el que debe leerse el texto de la presentacion. */
const LIGHT_BACKGROUND = { r: 255, g: 255, b: 255 };

export interface PreparedBranding {
  branding: OrganizationBranding;
  assets: LocalBrandAssets;
  css: string;
  /** Capa de diseno comun de las presentaciones. */
  baseCss: string;
  /** Guion que dispara las entradas al llegar cada diapositiva. */
  baseJs: string;
  /** Aviso para el usuario cuando la identidad no se aplico por completo. */
  notice: string | null;
}

export async function prepareBrandingForWorkspace(
  workspaceRoot: string,
  organizationId: string | null,
): Promise<PreparedBranding> {
  const resolved = await resolveOrganizationBranding(organizationId);
  const assets = await downloadBrandAssets(workspaceRoot, resolved);
  const branding = applyLogoPalette(resolved, assets);

  return {
    branding,
    assets,
    css: buildBrandCss(branding, assets),
    baseCss: DECK_BASE_CSS,
    baseJs: DECK_BASE_JS,
    notice: buildNotice(branding, assets),
  };
}

/**
 * Sustituye los colores por los del logo cuando este aporta una paleta y la
 * organizacion no configuro la suya. Cada color se corrige hasta alcanzar
 * contraste legible sobre fondo claro: un logo amarillo es perfecto como
 * marca y pesimo como color de texto.
 */
export function applyLogoPalette(
  branding: OrganizationBranding,
  assets: LocalBrandAssets,
): OrganizationBranding {
  if (!branding.enabled || !assets.logoAbsolutePath) return branding;
  if (hasCustomColors(branding)) return branding;

  const palette = extractPaletteFromLogoFile(assets.logoAbsolutePath);
  if (!palette) return branding;

  return {
    ...branding,
    colorPrimary: readable(palette.primary, branding.colorPrimary),
    colorSecondary: readable(palette.secondary, branding.colorSecondary),
    colorAccent: readable(palette.accent, branding.colorAccent),
    colorSource: 'logo',
  };
}

/**
 * Una organizacion "configuro su paleta" solo si algun color difiere de los
 * valores por defecto del esquema. Con los defaults intactos, el logo manda.
 */
const SCHEMA_DEFAULT_COLORS = new Set(['#3b82f6', '#10b981', '#8b5cf6']);

function hasCustomColors(branding: OrganizationBranding): boolean {
  return [branding.colorPrimary, branding.colorSecondary, branding.colorAccent].some(
    (color) => !SCHEMA_DEFAULT_COLORS.has(color.trim().toLowerCase()),
  );
}

function readable(candidate: string, fallback: string): string {
  const parsed = parseHex(candidate);
  if (!parsed) return fallback;
  return toHex(ensureContrast(parsed, LIGHT_BACKGROUND, 4.5));
}

function buildNotice(branding: OrganizationBranding, assets: LocalBrandAssets): string | null {
  if (!branding.enabled) {
    return 'Tu organizacion no tiene identidad corporativa habilitada; la presentacion usa el tema neutro.';
  }
  if (assets.missing.length > 0) {
    return `Apliqué la identidad de ${branding.organizationName ?? 'tu organizacion'}, pero no pude descargar: ${assets.missing.join(', ')}.`;
  }
  if (branding.colorSource === 'logo') {
    return `Tomé la paleta del logo de ${branding.organizationName ?? 'tu organizacion'}.`;
  }
  return null;
}
