import { desktopCapturer, type BrowserWindow, type WebContents } from 'electron';
import type { DisplayMediaSourcePreview } from '../../src/shared/display-media';

export const DISPLAY_MEDIA_THUMBNAIL = { width: 480, height: 270 };
export const DISPLAY_MEDIA_MAX_SOURCES = 100;
export interface DisplayMediaTab { id: string; name: string; documentToken: string; contents: WebContents }
export interface CaptureChoice {
  preview: DisplayMediaSourcePreview;
  resolve(followTab?: boolean): Promise<Electron.DesktopCapturerSource | Electron.WebFrameMain | null>;
}
const tabProviders = new WeakMap<BrowserWindow, () => DisplayMediaTab[]>();
export function setDisplayMediaTabProvider(window: BrowserWindow, provider: (() => DisplayMediaTab[]) | null): void {
  if (provider) tabProviders.set(window, provider);
  else tabProviders.delete(window);
}
const label = (name: string) => name.replace(/[\r\n\t]+/g, ' ').trim().slice(0, 160) || 'Sin nombre';
const image = (value: Electron.NativeImage | null): string | null => value && !value.isEmpty() ? value.toDataURL() : null;

export async function listDisplayMediaChoices(parent: BrowserWindow, excludedWindowId?: string): Promise<CaptureChoice[]> {
  const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: DISPLAY_MEDIA_THUMBNAIL, fetchWindowIcons: true });
  const choices: CaptureChoice[] = sources.filter((source) => source.id !== excludedWindowId).slice(0, DISPLAY_MEDIA_MAX_SOURCES).map((source) => ({
    preview: { id: source.id, name: label(source.name), kind: source.id.startsWith('screen:') ? 'screen' : 'window', thumbnail: image(source.thumbnail), appIcon: image(source.appIcon) },
    async resolve() {
      // La ventana pudo cerrarse mientras el usuario revisaba las miniaturas.
      const current = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 0, height: 0 } });
      return current.find((candidate) => candidate.id === source.id) ?? null;
    },
  }));
  const provider = tabProviders.get(parent);
  const tabs = provider?.() ?? [];
  for (const tab of tabs.slice(0, DISPLAY_MEDIA_MAX_SOURCES - choices.length)) {
    if (tab.contents.isDestroyed()) continue;
    const contents = tab.contents;
    const url = contents.getURL();
    const frame = contents.mainFrame;
    let thumbnail: string | null = null;
    try { thumbnail = image((await contents.capturePage()).resize(DISPLAY_MEDIA_THUMBNAIL)); }
    catch { /* Una pestaña no renderizada conserva una tarjeta sin miniatura. */ }
    if (contents.isDestroyed() || contents.getURL() !== url || tabProviders.get(parent) !== provider) continue;
    choices.push({
      preview: { id: `tab:${tab.id}`, name: label(tab.name), kind: 'tab', thumbnail, appIcon: null },
      async resolve(followTab = false) {
        const live = tabProviders.get(parent)?.().find((candidate) => candidate.id === tab.id && candidate.contents === contents);
        return live && !contents.isDestroyed() && (followTab || live.documentToken === tab.documentToken && contents.getURL() === url && contents.mainFrame === frame) ? contents.mainFrame : null;
      },
    });
  }
  return choices;
}
