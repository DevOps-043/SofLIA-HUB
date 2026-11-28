/** Sin opción, conservar espera de documento para agentes y clientes previos. */
export interface BrowserNavigationOptions {
  /** Acceso académico privado: URL oculta y sin historial/restauración. */
  sensitive?: boolean;
  waitForLoad?: boolean;
}

export interface BrowserObservationOptions {
  domOnly?: boolean;
  /** Revela un enlace en el documento principal. Requiere permiso de interacción. */
  findLink?: string;
}

export function normalizeBrowserLinkQuery(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 160) return undefined;
  const query = value.replace(/[\p{Cc}\s]+/gu, ' ').trim();
  return query.length >= 3 ? query : undefined;
}

/** Geometría de la vista; el inicio puede componerse en la interfaz existente. */
export interface BrowserViewport {
  x: number;
  y: number;
  width: number;
  height: number;
  homeInShell?: boolean;
}
