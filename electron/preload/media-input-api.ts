import type { PreloadBridge, SafeIpc } from './types';

/**
 * Superficie de subida de medios al proveedor.
 *
 * El renderer entrega la ruta del archivo y recibe la referencia remota; el
 * contenido nunca cruza esta frontera, que es lo que permite adjuntar un video
 * grande sin materializarlo en memoria.
 */
export function exposeMediaInputApi(bridge: PreloadBridge, ipc: SafeIpc): void {
  const { safeInvoke } = ipc;

  bridge.exposeInMainWorld('mediaInput', {
    upload: (input: { path: string; mimeType: string; apiKey: string }) =>
      safeInvoke('media-input:upload', input),

    status: (uploadId: string) => safeInvoke('media-input:status', { uploadId }),

    cancel: (uploadId: string) => safeInvoke('media-input:cancel', { uploadId }),

    /** Libera el archivo remoto al terminar o cancelarse el turno que lo consumia. */
    release: (uploadId: string, apiKey: string) =>
      safeInvoke('media-input:release', { uploadId, apiKey }),
  });
}
