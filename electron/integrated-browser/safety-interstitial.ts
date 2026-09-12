import { randomUUID } from 'node:crypto';
import { WebContentsView, type BaseWindow, type Rectangle, type WebContents } from 'electron';
import type { BrowserNavigationSafetyVerdict } from './safe-navigation';

const BLANK_ACTION = 'https://browser-safety.invalid/blank';
const CLOSE_ACTION = 'https://browser-safety.invalid/close';
export interface BrowserSafetyPresentation {
  parent: BaseWindow;
  bounds: Rectangle;
  verdict: BrowserNavigationSafetyVerdict;
  isCurrent: () => boolean;
  openBlank: () => Promise<void>;
  close: () => void;
  fillWindow?: boolean;
}
type Entry = { view: WebContentsView; contents: WebContents; input: BrowserSafetyPresentation; signature: string; busy: boolean; resize: () => void };

/** Superficie propia de main: no comparte sesión, preload, scripts ni herramientas del sitio. */
export class BrowserSafetyInterstitials {
  private readonly entries = new Map<string, Entry>();

  show(key: string, input: BrowserSafetyPresentation): void {
    if (!input.isCurrent() || input.parent.isDestroyed() || input.verdict.action !== 'block') { this.remove(key); return; }
    const signature = JSON.stringify([input.verdict.source, input.verdict.reason, input.verdict.checkedAt]);
    let entry = this.entries.get(key);
    if (entry && (entry.input.parent !== input.parent || entry.contents.isDestroyed())) { this.remove(key); entry = undefined; }
    if (!entry) {
      const view = new WebContentsView({ webPreferences: { partition: `browser-safety-${randomUUID()}`, sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: false, devTools: false } });
      entry = { view, contents: view.webContents, input, signature, busy: false, resize: () => undefined }; this.entries.set(key, entry);
      view.setBackgroundColor('#ffffff');
      view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      view.webContents.on('will-redirect', (event) => event.preventDefault());
      const captured = entry;
      captured.contents.once('destroyed', () => { if (this.entries.get(key) === captured) this.remove(key); });
      view.webContents.on('will-navigate', (event) => {
        event.preventDefault();
        if (this.entries.get(key) !== captured || captured.busy || !captured.input.isCurrent()) return;
        if (event.url !== BLANK_ACTION && event.url !== CLOSE_ACTION) return;
        captured.busy = true;
        const inputAtClick = captured.input;
        const action = event.url === BLANK_ACTION ? inputAtClick.openBlank : inputAtClick.close;
        void Promise.resolve().then(() => {
          if (this.entries.get(key) === captured && captured.input === inputAtClick && inputAtClick.isCurrent()) return action();
        }).catch(() => {
          if (this.entries.get(key) === captured && !captured.contents.isDestroyed()) {
            void captured.contents.loadURL(interstitialDocument({ ...captured.input.verdict, reason: 'No se pudo completar la acción. Vuelve a intentarlo o cierra esta superficie.' })).catch(() => console.warn('[Navegador][Seguridad] No se pudo mostrar el aviso de bloqueo.'));
          }
        }).finally(() => { captured.busy = false; });
      });
      // Defensa adicional: esta partición sólo muestra un documento data: fijo.
      view.webContents.session.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'file://*/*'] }, (_details, callback) => callback({ cancel: true }));
      input.parent.contentView.addChildView(view);
      captured.resize = () => {
        if (!captured.input.fillWindow || captured.input.parent.isDestroyed()) return;
        const bounds = captured.input.parent.getContentBounds();
        view.setBounds({ x: 0, y: 0, width: Math.max(1, bounds.width), height: Math.max(1, bounds.height) });
      };
      input.parent.on('resize', captured.resize);
      void view.webContents.loadURL(interstitialDocument(input.verdict)).catch(() => console.warn('[Navegador][Seguridad] No se pudo mostrar el aviso de bloqueo.'));
    } else {
      entry.input = input;
      if (entry.signature !== signature) {
        entry.signature = signature;
        void entry.view.webContents.loadURL(interstitialDocument(input.verdict)).catch(() => console.warn('[Navegador][Seguridad] No se pudo mostrar el aviso de bloqueo.'));
      }
    }
    entry.view.setBounds(input.bounds); entry.view.setVisible(true);
  }

  remove(key: string): void {
    const entry = this.entries.get(key); if (!entry) return;
    this.entries.delete(key);
    entry.input.parent.removeListener('resize', entry.resize);
    try { if (!entry.input.parent.isDestroyed()) entry.input.parent.contentView.removeChildView(entry.view); } catch { /* Ventana en cierre. */ }
    if (!entry.contents.isDestroyed()) entry.contents.close({ waitForBeforeUnload: false });
  }
  clear(): void { for (const key of this.entries.keys()) this.remove(key); }
}

function escapeHtml(value: string): string { return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!); }
export function interstitialDocument(verdict: BrowserNavigationSafetyVerdict): string {
  const reason = escapeHtml((verdict.reason || 'La solicitud no cumple la política de seguridad.').slice(0, 500));
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Solicitud bloqueada</title><style>
    :root{color-scheme:light dark}body{margin:0;background:Canvas;color:CanvasText;font:16px system-ui;display:grid;place-items:center;min-height:100vh}main{max-width:36rem;padding:2rem}h1{font-size:1.6rem}p{line-height:1.6}nav{display:flex;flex-wrap:wrap;gap:1rem;margin-top:2rem}a{color:LinkText;border:1px solid currentColor;border-radius:.6rem;padding:.8rem;text-decoration:none}a:focus-visible{outline:3px solid Highlight;outline-offset:3px}
    </style></head><body><main role="alert"><h1>Solicitud bloqueada por seguridad</h1><p>${reason}</p><p>No se permite omitir este bloqueo. Puedes escribir otra dirección en la barra o abrir una página en blanco.</p><nav aria-label="Acciones seguras"><a href="${BLANK_ACTION}">Abrir página en blanco</a><a href="${CLOSE_ACTION}">Cerrar pestaña o ventana</a></nav></main></body></html>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}
