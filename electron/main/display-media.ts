import { BrowserWindow, session, desktopCapturer, type Session } from 'electron';
import { pickDisplayMediaSource } from '../integrated-browser/display-media-picker';
import { configureStudioCapture, resolveStudioCapture } from '../studio-capture';
import { configureStudioOutput, resolveStudioOutput } from '../studio-output';

let owner: BrowserWindow | null = null;
let loopback = false;
let selecting = false;
/** Comparte un único handler para no destruir el selector al cerrar una captura de reunión. */
export function configureMainDisplayMedia(window: BrowserWindow): void {
  owner = window;
  configureStudioCapture(window);
  configureStudioOutput(window);
  install();
}
export function configureMeetingLoopback(enabled: boolean): void { loopback = enabled; install(); }
function install() {
  const handler: NonNullable<Parameters<Session['setDisplayMediaRequestHandler']>[0]> = async (request, callback) => {
    const win = owner;
    if (!win || win.isDestroyed() || !request.frame || request.frame.top !== win.webContents.mainFrame || selecting) { callback({}); return; }
    // Solo renderer principal o runtime SDK local, nunca una página web remota.
    const top = win.webContents.mainFrame;
    if (request.frame !== top) {
      try {
        const url = new URL(request.frame.url); const root = new URL(top.url);
        const sdk = url.protocol === 'soflia-zoom:' && url.host === 'meeting' && url.pathname === '/index.html';
        const local = url.protocol === root.protocol && url.host === root.host && /\/(?:packages\/zoom-runtime|zoom-runtime)\/index\.html$/.test(url.pathname);
        if (!sdk && !local) { callback({}); return; }
      } catch { callback({}); return; }
    }
    try {
      if (request.frame !== top) {
        const program = resolveStudioOutput(win);
        if (program.prepared) { callback(program.frame ? { video: program.frame } : {}); return; }
      }
      const bound = request.frame === top && request.audioRequested ? { bound: false as const } : await resolveStudioCapture(win, request.frame === top);
      if (bound.bound) {
        const selected = bound.selection;
        callback(selected && !win.isDestroyed() && !request.frame.detached ? { video: selected.video, ...(request.audioRequested && selected.withSystemAudio ? { audio: 'loopback' as const } : {}) } : {});
        return;
      }
    } catch { callback({}); return; }
    if (loopback && request.audioRequested && request.frame === top) {
      try { const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } }); callback(sources[0] ? { video: sources[0], audio: 'loopback' } : {}); }
      catch { callback({}); }
      return;
    }
    selecting = true;
    try {
      const frame = request.frame;
      const requestUrl = frame.url;
      const isRequestCurrent = () => {
        try { return !frame.detached && frame.url === requestUrl && !win.isDestroyed(); }
        catch { return false; }
      };
      const selected = await pickDisplayMediaSource({ parentWindow: win, audioRequested: request.audioRequested, isRequestCurrent });
      if (!isRequestCurrent() || !selected) callback({});
      else callback({ video: selected.video, ...(selected.withSystemAudio ? { audio: 'loopback' as const } : {}) });
    } catch { callback({}); }
    finally { selecting = false; }
  };
  session.defaultSession.setDisplayMediaRequestHandler(handler, { useSystemPicker: false });
}
