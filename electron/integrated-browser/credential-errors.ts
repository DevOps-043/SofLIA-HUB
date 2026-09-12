/** Mensajes propios de la bóveda, sin rutas, contenido de archivos ni secretos. */
export class BrowserCredentialError extends Error {
  constructor(message: string) { super(message); this.name = 'BrowserCredentialError'; }
}
