import { WebContentsView, type BrowserWindow } from 'electron';
import { IPC_APPROVAL_MS } from '../ipc/caller-authorization';

const APPROVE = 'https://computer-approval.invalid/approve';
const CANCEL = 'https://computer-approval.invalid/cancel';
const pending = new WeakMap<BrowserWindow, () => void>();

export function cancelComputerApproval(parent: BrowserWindow): void {
  pending.get(parent)?.();
}

/** La vista no comparte DOM, preload ni navegación con el chat o la página. */
export async function showComputerApproval(parent: BrowserWindow, title: string, detail: string, assert: () => void, signal: AbortSignal): Promise<boolean> {
  assert();
  if (signal.aborted || pending.has(parent)) return false;
  const view = new WebContentsView({ webPreferences: {
    partition: 'computer-approval', sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: false, devTools: false,
  } });
  const contents = view.webContents;
  return new Promise<boolean>(resolve => {
    let finished = false;
    let attached = false;
    const deadline = Date.now() + IPC_APPROVAL_MS;
    const finish = (approved: boolean) => {
      if (finished) return;
      finished = true;
      pending.delete(parent);
      clearTimeout(timer);
      signal.removeEventListener('abort', cancel);
      parent.removeListener('closed', cancel);
      parent.removeListener('resize', resize);
      resolve(approved);
      try {
        if (attached && !parent.isDestroyed()) parent.contentView.removeChildView(view);
        if (!contents.isDestroyed()) contents.close({ waitForBeforeUnload: false });
      } catch { /* La ventana puede estar cerrándose. */ }
    };
    const cancel = () => finish(false);
    const timer = setTimeout(cancel, IPC_APPROVAL_MS);
    const resize = () => {
      const { width, height } = parent.getContentBounds();
      view.setBounds({ x: 0, y: 0, width, height });
    };
    pending.set(parent, cancel);
    try {
      signal.addEventListener('abort', cancel, { once: true });
      parent.once('closed', cancel);
      parent.on('resize', resize);
      contents.once('destroyed', cancel);
      contents.once('render-process-gone', cancel);
      contents.setWindowOpenHandler(() => ({ action: 'deny' }));
      contents.on('will-redirect', event => event.preventDefault());
      contents.on('will-navigate', event => {
        event.preventDefault();
        if (event.url === CANCEL) { cancel(); return; }
        if (event.url !== APPROVE) return;
        try { assert(); finish(!signal.aborted && Date.now() < deadline); }
        catch { cancel(); }
      });
      contents.on('before-input-event', (event, input) => {
        if (input.type === 'keyDown' && input.key === 'Escape') { event.preventDefault(); cancel(); }
      });
      view.setBackgroundColor('#0a2540');
      resize();
      void contents.loadURL(approvalDocument(title, detail)).then(() => {
        if (finished) return;
        assert();
        if (signal.aborted) { cancel(); return; }
        attached = true;
        parent.contentView.addChildView(view);
        contents.focus();
      }).catch(cancel);
    } catch { cancel(); }
  });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>]/g, character => character === '&' ? '&amp;' : character === '<' ? '&lt;' : '&gt;');
}

function approvalDocument(title: string, detail: string): string {
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${escapeHtml(title)}</title><style>
  :root{color-scheme:light dark;font:15px system-ui;background:Canvas;color:CanvasText}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0a2540}main{box-sizing:border-box;width:min(94vw,44rem);padding:clamp(1rem,4vw,2rem);border-radius:1rem;background:Canvas;box-shadow:0 1rem 4rem #0006}h1{font-size:1.3rem;margin:0 0 1rem}pre{font:inherit;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere;overflow:auto;max-height:48vh;background:color-mix(in srgb,CanvasText 6%,Canvas);padding:1rem;border-radius:.65rem}nav{display:flex;flex-wrap:wrap;justify-content:end;gap:.6rem;margin-top:1.25rem}a{padding:.55rem .9rem;border-radius:.55rem;border:1px solid GrayText;color:CanvasText;text-decoration:none}a:last-child{background:#00d4b3;color:#0a2540;border-color:#00d4b3}a:focus-visible,pre:focus-visible{outline:3px solid Highlight;outline-offset:3px}
  </style></head><body><main aria-labelledby="titulo"><h1 id="titulo">${escapeHtml(title)}</h1><pre tabindex="0">${escapeHtml(detail)}</pre><nav aria-label="Decisión"><a href="${CANCEL}">Cancelar</a><a href="${APPROVE}">Autorizar</a></nav></main></body></html>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}
