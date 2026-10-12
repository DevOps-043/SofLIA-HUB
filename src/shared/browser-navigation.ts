/** Sin opción, conservar espera de documento para agentes y clientes previos. */
export interface BrowserNavigationOptions {
  /** Acceso académico privado: URL oculta y sin historial/restauración. */
  sensitive?: boolean;
  waitForLoad?: boolean;
}

/** Geometría de la vista; el inicio puede componerse en la interfaz existente. */
export interface BrowserViewport {
  x: number;
  y: number;
  width: number;
  height: number;
  homeInShell?: boolean;
}
