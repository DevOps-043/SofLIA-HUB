import { integratedBrowserService, type BrowserDownloadRecord } from '../integrated-browser-service';

const DOWNLOAD_WAIT_MS = 45_000;
const ACTIVE_STATES = new Set(['pending', 'progressing', 'paused']);

export async function inspectBrowserDownloads(args: Record<string, unknown>, signal?: AbortSignal): Promise<string> {
  const id = args.download_id;
  if (id !== undefined && (typeof id !== 'string' || !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(id))) {
    return JSON.stringify({ success: false, error: 'Identificador de descarga inválido.' });
  }
  if (args.wait === true && typeof id !== 'string') {
    return JSON.stringify({ success: false, error: 'Lista las descargas primero para identificar la transferencia que quieres esperar.' });
  }
  const result = await integratedBrowserService.listDownloads();
  signal?.throwIfAborted();
  if (!result.success) return JSON.stringify({ success: false, error: result.error || 'No se pudo consultar la lista de descargas.' });
  if (!id) return JSON.stringify({ success: true, downloads: result.downloads?.slice(0, 10) ?? [], untrustedContent: true });
  const download = result.downloads?.find(record => record.id === id);
  if (!download) return JSON.stringify({ success: false, error: 'La descarga no está disponible en el perfil actual.' });
  const final = args.wait === true && ACTIVE_STATES.has(download.state) ? await waitForDownload(download, signal) : download;
  if (!final) return JSON.stringify({ success: false, error: 'La descarga dejó de estar disponible en el perfil actual.' });
  return JSON.stringify({ success: true, download: final, completed: final.state === 'completed' && Boolean(final.savedPath), untrustedContent: true });
}

function waitForDownload(initial: BrowserDownloadRecord, signal?: AbortSignal): Promise<BrowserDownloadRecord | null> {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    let latest = initial;
    let finished = false;
    let unsubscribe: (() => void) | undefined;
    const cleanup = () => {
      finished = true;
      clearTimeout(timer);
      unsubscribe?.();
      signal?.removeEventListener('abort', cancel);
    };
    const finish = (record: BrowserDownloadRecord | null) => {
      if (finished) return;
      cleanup(); resolve(record);
    };
    const cancel = () => { cleanup(); reject(signal?.reason); };
    const inspect = (records: BrowserDownloadRecord[]) => {
      const record = records.find(item => item.id === initial.id);
      if (!record || !ACTIVE_STATES.has(record.state)) { finish(record ?? null); return; }
      latest = record;
    };
    const timer = setTimeout(() => finish(latest), DOWNLOAD_WAIT_MS);
    try {
      unsubscribe = integratedBrowserService.subscribe({ onDownloadsChanged: inspect });
      signal?.addEventListener('abort', cancel, { once: true });
    } catch (error) { cleanup(); reject(error); return; }
    // Cubrir una finalización entre la primera consulta y la suscripción.
    void integratedBrowserService.listDownloads().then(result => {
      if (result.success) inspect(result.downloads ?? []);
      else finish(null);
    }).catch(() => finish(null));
  });
}
