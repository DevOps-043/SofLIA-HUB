import { dialog, type BrowserWindow, type SelectWebauthnAccountDetails, type Session, type WebContents } from 'electron';

export const PASSKEY_SELECTION_TIMEOUT_MS = 60_000;
type PasskeyContext = { parent: BrowserWindow; contents: WebContents; assertCurrent: () => void };
type ResolveContext = (details: SelectWebauthnAccountDetails) => PasskeyContext;

/** Selección humana del proveedor Chromium/SO. Nunca crea, exporta ni guarda claves. */
export class BrowserPasskeySelection {
  private pending: (() => void) | null = null;
  private disposed = false;
  private readonly unsubscribe: () => void;
  constructor(private readonly session: Session, private readonly resolveContext: ResolveContext,
    subscribeInvalidation: (cancel: () => void) => () => void = () => () => {}) {
    session.on('select-webauthn-account', this.onSelect);
    this.unsubscribe = subscribeInvalidation(() => this.cancel());
  }

  cancel(): void { this.pending?.(); }
  dispose(): void {
    this.disposed = true; this.cancel();
    this.unsubscribe();
    this.session.removeListener('select-webauthn-account', this.onSelect);
  }

  private readonly onSelect = (_event: Electron.Event, details: SelectWebauthnAccountDetails,
    callback: (credentialId?: string | null) => void): void => {
    if (this.disposed || this.pending) { callback(); return; }
    let completed = false;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cleanup = () => {};
    const finish = (id?: string) => {
      if (completed) return;
      completed = true;
      if (timer) clearTimeout(timer);
      controller.abort(); cleanup();
      // El identificador sólo regresa al callback nativo que lo emitió, nunca al IPC.
      callback(id);
    };
    this.pending = () => finish();
    void (async () => {
      try {
        const context = this.resolveContext(details);
        const { contents, parent } = context;
        const frame = details.frame;
        const url = contents.getURL();
        const source = new URL(url);
        const rp = details.relyingPartyId;
        if (!frame || frame !== contents.mainFrame || frame.detached || !isSecureSource(source)
          || typeof rp !== 'string' || rp.length > 253 || !/^[a-z0-9.-]+$/i.test(rp)
          || (source.hostname !== rp && !source.hostname.endsWith(`.${rp}`))) return;
        if (!Array.isArray(details.accounts) || !details.accounts.length || details.accounts.length > 10) return;
        const accounts = details.accounts.map((account, index) => {
          if (!account || typeof account.credentialId !== 'string' || !/^[A-Za-z0-9_-]{1,2048}$/.test(account.credentialId)) throw new Error('Cuenta no válida.');
          return { id: account.credentialId, label: `${index + 1}. ${safeLabel(account.name) || safeLabel(account.displayName) || 'Cuenta sin nombre'}` };
        });
        if (new Set(accounts.map(account => account.id)).size !== accounts.length) return;
        const valid = () => {
          context.assertCurrent();
          if (this.disposed || completed || parent.isDestroyed() || !parent.isVisible() || contents.isDestroyed()
            || contents.getURL() !== url || contents.mainFrame !== frame || frame.detached) throw new Error('Selección obsoleta.');
        };
        const cancel = () => finish();
        const navigating = (_navigationEvent: unknown, _url: string, _inPlace: boolean, mainFrame: boolean) => { if (mainFrame) cancel(); };
        contents.on('did-start-navigation', navigating);
        contents.once('destroyed', cancel); parent.once('closed', cancel); parent.on('hide', cancel);
        cleanup = () => {
          contents.removeListener('did-start-navigation', navigating); contents.removeListener('destroyed', cancel);
          parent.removeListener('closed', cancel); parent.removeListener('hide', cancel);
        };
        timer = setTimeout(cancel, PASSKEY_SELECTION_TIMEOUT_MS); timer.unref?.();
        valid();
        const result = await dialog.showMessageBox(parent, {
          type: 'question', title: 'Elegir cuenta de passkey', message: `Acceder a ${source.origin}`,
          detail: `Proveedor solicitado: ${rp}\nElige una cuenta del proveedor del sistema. Pulse Hub no recibe ni guarda su clave privada. Si no reconoces este sitio, cancela.`,
          buttons: ['Cancelar', ...accounts.map(account => account.label)], defaultId: 0, cancelId: 0, noLink: true,
          signal: controller.signal,
        });
        valid();
        if (Number.isInteger(result.response) && result.response > 0 && result.response <= accounts.length) finish(accounts[result.response - 1].id);
      } catch { /* Cancelación, documento inválido y proveedor fallido terminan sin conceder. */ }
      finally { finish(); this.pending = null; }
    })();
  };
}

function safeLabel(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, 512).replace(/[\p{Cc}\p{Cf}&]/gu, '').trim().slice(0, 80) : '';
}

function isSecureSource(url: URL): boolean {
  return !url.username && !url.password && (url.protocol === 'https:'
    || url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
}
