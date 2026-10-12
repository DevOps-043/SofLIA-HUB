import type { BrowserWindow, WebFrameMain } from 'electron';

/** Bloquea navegación de documentos srcdoc antes de que puedan abandonar su CSP local. */
export function bindArtifactNavigation(window: BrowserWindow, isHtmlPreviewUrl: (url: string) => boolean = () => false): () => void {
  const guard = (details: { frame: WebFrameMain | null; initiator?: WebFrameMain | null; url: string; preventDefault(): void }) => {
    const isolated = [details.frame?.url, details.initiator?.url].some(url => url === 'about:srcdoc' || Boolean(url && isHtmlPreviewUrl(url)));
    if (isolated) details.preventDefault();
  };
  window.webContents.on('will-frame-navigate', guard);
  return () => { if (!window.webContents.isDestroyed()) window.webContents.off('will-frame-navigate', guard); };
}
