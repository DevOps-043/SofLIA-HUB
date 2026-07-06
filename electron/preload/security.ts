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
    "img-src 'self' data: blob: https: http:",
    "media-src 'self' data: blob:",
    "font-src 'self' data: https: http:",
    "connect-src 'self' https: http: ws: wss:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => document.head.appendChild(meta));
    return;
  }
  document.head.appendChild(meta);
}
