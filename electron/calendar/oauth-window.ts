import { BrowserWindow, shell } from 'electron';
import { onAuthStateChange } from '../main/auth-state';
import { OAUTH_REDIRECT_PORT } from './constants';
import { validateOAuthDestination, type OAuthProof } from './oauth-proof';
import { createOAuthReceiver } from './oauth-receiver';

export interface OAuthWindowOptions {
  provider: 'google' | 'microsoft';
  clientId: string;
  proof: OAuthProof;
  assertCurrent: () => void;
  signal?: AbortSignal;
  parent?: BrowserWindow;
}

const statusHtml = '<!doctype html><html lang="es"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; base-uri \'none\'; form-action \'none\'"><title>Autorización</title><body><h1>Continúa en tu navegador</h1><p>Autoriza la conexión en el navegador del sistema. Cierra esta ventana para cancelar.</p></body></html>';

/** Fachada main: nunca carga el proveedor dentro del WebContents del Hub. */
export async function openOAuthWindow(authUrl: string, title: string, options: OAuthWindowOptions): Promise<string | null> {
  validateOAuthDestination(authUrl, options.provider, options.proof, options.clientId); options.assertCurrent();
  const receiver = createOAuthReceiver({ state: options.proof.state, assertCurrent: options.assertCurrent, port: OAUTH_REDIRECT_PORT });
  let window: BrowserWindow | null = null;
  const unsubscribe = onAuthStateChange(() => { try { options.assertCurrent(); } catch { void receiver.cancel(); } });
  const closed = () => { void receiver.cancel(); };
  options.signal?.addEventListener('abort', closed, { once: true });
  if (options.signal?.aborted) closed();
  const completed = receiver.result.then(code => ({ kind: 'completed' as const, code }));
  const complete = (code: string | null) => { options.assertCurrent(); return code; };
  try {
    if (!await receiver.ready) throw new Error('No se pudo iniciar la recepción OAuth local.');
    options.assertCurrent();
    if (!receiver.isPending()) return complete(await receiver.result);
    window = new BrowserWindow({ parent: options.parent, width: 440, height: 260, title: `Conectar ${title}`, show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } });
    window.on('closed', closed);
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', event => event.preventDefault());
    const loaded = await Promise.race([window.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(statusHtml))
      .then(() => ({ kind: 'loaded' as const })), completed]);
    if (loaded.kind === 'completed') return complete(loaded.code);
    options.assertCurrent();
    if (window.isDestroyed() || !receiver.isPending()) return complete(await receiver.result);
    window.show();
    const launched = await Promise.race([shell.openExternal(authUrl).then(() => ({ kind: 'launched' as const })), completed]);
    if (launched.kind === 'completed') return complete(launched.code);
    options.assertCurrent();
    return complete(await receiver.result);
  } finally {
    unsubscribe();
    options.signal?.removeEventListener('abort', closed);
    try { if (window && !window.isDestroyed()) { window.removeListener('closed', closed); window.destroy(); } }
    finally { await receiver.cancel(); }
  }
}
