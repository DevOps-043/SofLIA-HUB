import { zoomJoinSchema } from '../../src/shared/live-studio.contract';
const nonce = location.hash.slice(1);
let loading = false, disposed = false;
window.addEventListener('pagehide', () => { disposed = true; });
window.addEventListener('message', async (event) => {
  if (event.source !== parent || event.data?.nonce !== nonce || event.data?.source !== 'soflia-studio') return;
  if (event.data.type === 'leave') { disposed = true; return; }
  if (event.data.type !== 'join' || loading || disposed) return;
  loading = true;
  try {
    const args = zoomJoinSchema.parse(event.data.detail);
    const runtime = args.provider === 'zoom-video' ? await import('./video-runtime') : await import('./meeting-runtime');
    if (!disposed) runtime.start(new MessageEvent('message', { source: event.source, origin: event.origin, data: { ...event.data, detail: args } }));
  } catch {
    const status = document.getElementById('status')!;
    status.hidden = false; status.textContent = 'No se pudo preparar la conexión audiovisual. Revisa el ingreso y vuelve a conectar.';
    parent.postMessage({ source: 'soflia-zoom', nonce, type: 'error' }, event.origin === 'null' ? '*' : event.origin);
  }
});
parent.postMessage({ source: 'soflia-zoom', nonce, type: 'ready' }, '*');
