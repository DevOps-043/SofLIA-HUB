import { WebContentsView, type BrowserWindow } from 'electron';
import { buildPresentationUrl, PRESENTATION_PARTITION, PRESENTATION_SCHEME } from './protocol';

/**
 * Vista a pantalla completa para presentar.
 *
 * Se usa una `WebContentsView` y no el `iframe` del panel porque es la unica
 * forma de ocupar la ventana sin que el chat compita por el z-order. A
 * cambio, no puede embeberse dentro de una burbuja del chat: por eso
 * conviven las dos superficies.
 *
 * Aislamiento: sin preload (no hay puente IPC que alcanzar), sin
 * integracion de Node y en una particion propia, de modo que la
 * presentacion no comparte cookies ni almacenamiento con el navegador
 * integrado ni con la aplicacion.
 */

/** Destino que main intercepta para cerrar la vista a pantalla completa. */
const EXIT_URL = `${PRESENTATION_SCHEME}://salir`;

/**
 * Control de salida inyectado en la presentacion.
 *
 * La vista cubre toda la ventana y el documento no tiene preload, asi que sin
 * esto no habia ninguna forma visible de volver: el usuario quedaba atrapado.
 * Se inyecta despues de cargar para no depender de que el modelo lo incluya
 * en el HTML generado, y se retira del flujo de impresion y de la exportacion
 * porque solo existe dentro de la aplicacion.
 */
const EXIT_BUTTON_SCRIPT = `(() => {
  if (document.getElementById('pulse-salir')) return;
  const boton = document.createElement('button');
  boton.id = 'pulse-salir';
  boton.type = 'button';
  boton.setAttribute('aria-label', 'Salir de la presentacion');
  boton.title = 'Salir (Esc)';
  boton.textContent = 'Salir';
  boton.style.cssText = [
    'position:fixed', 'top:16px', 'right:16px', 'z-index:2147483647',
    'padding:8px 16px', 'border-radius:999px', 'border:1px solid rgba(255,255,255,.25)',
    'background:rgba(15,20,26,.72)', 'color:#fff', 'font:600 13px/1 system-ui,sans-serif',
    'cursor:pointer', 'backdrop-filter:blur(8px)', 'opacity:0', 'transition:opacity .2s',
  ].join(';');
  boton.addEventListener('click', () => { window.location.href = ${JSON.stringify(EXIT_URL)}; });

  // Aparece al mover el raton o al acercarse arriba, y se desvanece solo:
  // durante la presentacion no debe competir con el contenido.
  let temporizador;
  const mostrar = () => {
    boton.style.opacity = '1';
    clearTimeout(temporizador);
    temporizador = setTimeout(() => { boton.style.opacity = '0'; }, 2500);
  };
  document.addEventListener('mousemove', mostrar, { passive: true });
  boton.addEventListener('focus', mostrar);
  document.body.appendChild(boton);
  mostrar();
})();`;

export class PresentationViewController {
  private view: WebContentsView | null = null;
  private onClosedCallback: (() => void) | null = null;

  constructor(private readonly getParentWindow: () => BrowserWindow | null) {}

  isOpen(): boolean {
    return Boolean(this.view && !this.view.webContents.isDestroyed());
  }

  onClosed(callback: () => void): void {
    this.onClosedCallback = callback;
  }

  /**
   * Abre la presentacion ocupando la ventana. Si ya habia una vista abierta
   * se destruye antes: nunca coexisten dos.
   */
  openUrl(runtimeUrl: string): { ok: true } | { ok: false; error: string } {
    const parent = this.getParentWindow();
    if (!parent || parent.isDestroyed()) {
      return { ok: false, error: 'No hay una ventana disponible para presentar.' };
    }

    this.close();

    const view = new WebContentsView({
      webPreferences: {
        partition: PRESENTATION_PARTITION,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
        allowRunningInsecureContent: false,
        // Sin preload: la presentacion no debe tener ninguna via hacia IPC.
        spellcheck: false,
      },
    });

    view.setBackgroundColor('#0d1117');
    parent.contentView.addChildView(view);
    this.view = view;
    this.applyBounds();

    // Un enlace externo dentro de la presentacion no debe abrir ventanas ni
    // navegar la vista fuera del protocolo local.
    view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    view.webContents.on('will-navigate', (event, url) => {
      // El boton de salir navega a este destino sentinela: la presentacion no
      // tiene preload ni IPC, asi que una navegacion interceptada es su unica
      // via para pedirle algo a main.
      if (url.startsWith(EXIT_URL)) {
        event.preventDefault();
        this.close();
        return;
      }
      if (!isPresentationNavigation(url, runtimeUrl)) event.preventDefault();
    });
    // Escape cierra sin depender de que el usuario encuentre el boton.
    view.webContents.on('before-input-event', (event, input) => {
      if (input.type === 'keyDown' && input.key === 'Escape') {
        event.preventDefault();
        this.close();
      }
    });
    view.webContents.on('destroyed', () => this.handleClosed());
    view.webContents.on('did-finish-load', () => {
      void view.webContents.executeJavaScript(EXIT_BUTTON_SCRIPT).catch(() => undefined);
    });

    void view.webContents.loadURL(runtimeUrl);
    return { ok: true };
  }

  /** Fachada temporal para barajas HTML heredadas. */
  open(workspaceId: string, entryFile = 'index.html'): { ok: true } | { ok: false; error: string } {
    return this.openUrl(buildPresentationUrl(workspaceId, entryFile));
  }

  /** Ajusta la vista al tamano actual de la ventana. */
  applyBounds(): void {
    const parent = this.getParentWindow();
    if (!this.view || !parent || parent.isDestroyed()) return;
    const { width, height } = parent.getContentBounds();
    this.view.setBounds({ x: 0, y: 0, width, height });
  }

  close(): void {
    const view = this.view;
    if (!view) return;
    this.view = null;

    const parent = this.getParentWindow();
    try {
      if (parent && !parent.isDestroyed()) parent.contentView.removeChildView(view);
    } catch {
      // La ventana pudo cerrarse antes; el destroy siguiente igual libera la vista.
    }
    if (!view.webContents.isDestroyed()) view.webContents.close();
    this.handleClosed();
  }

  private handleClosed(): void {
    if (this.view) return;
    this.onClosedCallback?.();
  }
}

function isPresentationNavigation(target: string, runtimeUrl: string): boolean {
  if (target.startsWith(EXIT_URL) || target.startsWith(`${PRESENTATION_SCHEME}://`)) return true;
  try {
    const current = new URL(runtimeUrl);
    const next = new URL(target);
    const local = (value: URL) => value.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(value.hostname);
    return local(current) && local(next);
  } catch {
    return false;
  }
}
