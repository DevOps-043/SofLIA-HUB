export function assertContextIsolation(): void {
  if (process.contextIsolated) return;
  console.error('ALERTA DE SEGURIDAD: contextIsolation debe estar habilitado en webPreferences.');
  throw new Error('contextIsolation no esta habilitado.');
}

export function injectCSP(): void {
  const meta = document.createElement('meta');
  meta.httpEquiv = 'Content-Security-Policy';
  meta.content = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    // `pulse-presentacion:` sirve tambien las imagenes del espacio de trabajo:
    // el panel las muestra como imagen en vez de leerlas como texto, que era
    // lo que pintaba un PNG como binario y bloqueaba la aplicacion.
    "img-src 'self' data: blob: https: http: pulse-presentacion:",
    "media-src 'self' data: blob:",
    "font-src 'self' data: https: http:",
    "connect-src 'self' https: http: ws: wss:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // El runtime React se sirve desde un puerto efimero ligado exclusivamente
    // a loopback. La CSP debe permitir ese iframe local ademas del protocolo
    // legado; un host HTTP remoto continua bloqueado.
    "frame-src 'self' pulse-presentacion: http://127.0.0.1:*",
  ].join('; ');

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => document.head.appendChild(meta));
    return;
  }
  document.head.appendChild(meta);
}
