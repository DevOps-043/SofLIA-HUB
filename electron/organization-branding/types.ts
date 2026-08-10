/**
 * Identidad visual de una organizacion resuelta para aplicarla a un
 * entregable. Contiene SOLO datos de presentacion: nunca credenciales,
 * datos de suscripcion ni informacion de miembros.
 */
export interface OrganizationBranding {
  organizationId: string | null;
  organizationName: string | null;
  /** Falso cuando la organizacion no habilito branding o no hay datos. */
  enabled: boolean;
  colorPrimary: string;
  colorSecondary: string;
  colorAccent: string;
  fontFamily: string;
  /** URLs de origen; se descargan a `<workspace>/assets/` antes de usarse. */
  logoUrl: string | null;
  faviconUrl: string | null;
  bannerUrl: string | null;
  /** Recursos que no se pudieron descargar, para informar sin bloquear. */
  missingAssets: string[];
  /**
   * Origen de los colores aplicados. `logo` significa que se extrajeron del
   * propio logotipo; `declarado`, de las columnas de la organizacion;
   * `neutro`, del tema del producto.
   */
  colorSource: 'logo' | 'declarado' | 'neutro';
}

/** Tema neutro del producto cuando no hay identidad corporativa aplicable. */
export const NEUTRAL_BRANDING: OrganizationBranding = Object.freeze({
  organizationId: null,
  organizationName: null,
  enabled: false,
  colorPrimary: '#10b981',
  colorSecondary: '#0f766e',
  colorAccent: '#38bdf8',
  fontFamily: "'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif",
  logoUrl: null,
  faviconUrl: null,
  bannerUrl: null,
  missingAssets: [],
  colorSource: 'neutro',
});

/** Recursos ya descargados al workspace, como rutas relativas. */
export interface LocalBrandAssets {
  logo: string | null;
  banner: string | null;
  missing: string[];
  /** Ruta absoluta del logo descargado; solo main la usa, para la paleta. */
  logoAbsolutePath?: string | null;
}
