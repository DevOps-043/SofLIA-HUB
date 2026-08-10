import type { LocalBrandAssets, OrganizationBranding } from './types';

/**
 * Hoja de variables CSS de marca que main escribe en el workspace ANTES de
 * que el modelo empiece a generar.
 *
 * Es la pieza que hace que la identidad corporativa no dependa de que el
 * modelo copie bien un hexadecimal: el prompt le prohibe escribir colores
 * literales y le obliga a consumir estas variables.
 */
export function buildBrandCss(branding: OrganizationBranding, assets: LocalBrandAssets): string {
  const encabezado = branding.enabled
    ? `/* Identidad visual de ${escapeComment(branding.organizationName ?? 'la organizacion')}.\n   Generado por Pulse Hub. NO EDITAR: se reescribe en cada generacion. */`
    : `/* Tema neutro de Pulse Hub: la organizacion no tiene identidad corporativa\n   habilitada. NO EDITAR: se reescribe en cada generacion. */`;

  // Las rutas de los recursos ya son relativas al workspace y su nombre lo
  // decide main, no el modelo ni la URL de origen.
  const logo = assets.logo ? `url('${assets.logo}')` : 'none';
  const banner = assets.banner ? `url('${assets.banner}')` : 'none';

  return `${encabezado}
:root {
  --marca-color-primario: ${branding.colorPrimary};
  --marca-color-secundario: ${branding.colorSecondary};
  --marca-color-acento: ${branding.colorAccent};
  --marca-color-fondo: #ffffff;
  --marca-color-texto: #10151c;
  --marca-color-texto-tenue: #55606d;
  --marca-tipografia: ${branding.fontFamily};
  --marca-logo: ${logo};
  --marca-banner: ${banner};
  --marca-habilitada: ${branding.enabled ? 1 : 0};
  /* Origen de los colores: logo | declarado | neutro. */
  --marca-origen-color: '${branding.colorSource}';
}

@media (prefers-color-scheme: dark) {
  :root {
    --marca-color-fondo: #0d1117;
    --marca-color-texto: #f2f5f8;
    --marca-color-texto-tenue: #a8b3bf;
  }
}
`;
}

/**
 * Impide que un nombre que contenga un cierre de comentario CSS escape del
 * encabezado y quede como regla activa en la hoja de estilos.
 */
function escapeComment(value: string): string {
  return value.replace(/\*\//g, '* /').slice(0, 120);
}
