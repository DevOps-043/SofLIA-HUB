import { app, BrowserWindow, ipcMain, nativeTheme, type IpcMainInvokeEvent } from 'electron';
import path from 'node:path';
import { listDisplayMediaChoices, type CaptureChoice } from './display-media-sources';
import type { DisplayMediaPickerResult } from '../../src/shared/display-media';
export { setDisplayMediaTabProvider } from './display-media-sources';

export interface DisplayMediaSelection {
  video: Electron.DesktopCapturerSource | Electron.WebFrameMain;
  withSystemAudio: boolean;
  choice: CaptureChoice;
}
const PICKER_TIMEOUT_MS = 120_000;
const active = new Map<number, {
  window: BrowserWindow;
  parent: BrowserWindow;
  choices: CaptureChoice[];
  audioAvailable: boolean;
  loading: boolean;
  choosing: boolean;
  purpose?: 'bind';
  isRequestCurrent(): boolean;
  finish(selection: DisplayMediaSelection | null): void;
}>();
let registered = false;

function authorized(event: IpcMainInvokeEvent) {
  const picker = active.get(event.sender.id);
  if (picker && !picker.isRequestCurrent()) { picker.finish(null); return null; }
  return picker && event.senderFrame === picker.window.webContents.mainFrame
    && !picker.window.isDestroyed() && !picker.parent.isDestroyed() ? picker : null;
}

function registerHandlers(): void {
  if (registered) return;
  registered = true;
  ipcMain.handle('display-media:list', async (event): Promise<DisplayMediaPickerResult> => {
    const picker = authorized(event);
    if (!picker) return { success: false, error: 'El selector ya no está disponible.' };
    if (picker.loading || picker.choosing) return { success: false, error: 'Espera a que termine la operación actual.' };
    picker.loading = true;
    try {
      const choices = await listDisplayMediaChoices(picker.parent, picker.window.getMediaSourceId());
      if (authorized(event) !== picker) return { success: false, error: 'El selector se cerró.' };
      picker.choices = choices;
      return { success: true, snapshot: { sources: choices.map((choice) => choice.preview), audioAvailable: picker.audioAvailable, dark: nativeTheme.shouldUseDarkColors, purpose: picker.purpose } };
    } catch { return { success: false, error: 'No pudimos cargar las vistas previas. Revisa los permisos de captura y vuelve a intentar.' }; }
    finally { picker.loading = false; }
  });
  ipcMain.handle('display-media:select', async (event, input: unknown) => {
    const picker = authorized(event);
    if (!picker || picker.loading || picker.choosing) return { success: false, error: 'El selector no está disponible.' };
    if (!input || typeof input !== 'object' || Array.isArray(input)) return { success: false, error: 'Selección inválida.' };
    const payload = input as Record<string, unknown>;
    if (Object.keys(payload).length !== 2 || typeof payload.sourceId !== 'string' || payload.sourceId.length > 200 || typeof payload.withSystemAudio !== 'boolean') return { success: false, error: 'Selección inválida.' };
    const choice = picker.choices.find((source) => source.preview.id === payload.sourceId);
    if (!choice) return { success: false, error: 'Elige una fuente disponible.' };
    picker.choosing = true;
    try {
      const video = await choice.resolve();
      if (authorized(event) !== picker) return { success: false, error: 'La solicitud se canceló.' };
      if (!video) return { success: false, error: 'Esta fuente ya no está disponible. Actualiza las vistas previas.' };
      picker.finish({ video, withSystemAudio: picker.audioAvailable && payload.withSystemAudio, choice });
      return { success: true };
    } catch { return { success: false, error: 'No pudimos compartir esta fuente. Vuelve a intentar.' }; }
    finally { picker.choosing = false; }
  });
  ipcMain.handle('display-media:cancel', (event) => {
    const picker = authorized(event);
    if (!picker) return { success: false };
    picker.finish(null);
    return { success: true };
  });
}

/** Solo el selector local recibe miniaturas. La página solicitante recibe la fuente elegida. */
export async function pickDisplayMediaSource(input: { parentWindow: BrowserWindow | null; audioRequested: boolean; isRequestCurrent?: () => boolean; purpose?: 'bind' }): Promise<DisplayMediaSelection | null> {
  const parent = input.parentWindow;
  if (!parent || parent.isDestroyed() || [...active.values()].some((picker) => picker.parent === parent)) return null;
  registerHandlers();
  const runtimeDir = path.join(app.getAppPath(), 'dist-electron');
  const picker = new BrowserWindow({
    parent, modal: true, frame: false, show: false, width: 1040, height: 760, minWidth: 720, minHeight: 560,
    title: 'Compartir pantalla', backgroundColor: nativeTheme.shouldUseDarkColors ? '#0f1419' : '#f9fafb',
    webPreferences: { preload: path.join(runtimeDir, 'preload.js'), additionalArguments: ['--display-media-picker'], sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  picker.setMenu(null);
  picker.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  picker.webContents.on('will-navigate', (event) => event.preventDefault());
  picker.webContents.on('will-redirect', (event) => event.preventDefault());
  return new Promise((resolve) => {
    let finished = false;
    const finish = (selection: DisplayMediaSelection | null) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      parent.removeListener('closed', cancel);
      parent.webContents.removeListener('did-start-navigation', parentNavigation);
      active.delete(picker.webContents.id);
      resolve(selection);
      if (!picker.isDestroyed()) picker.destroy();
    };
    const cancel = () => finish(null);
    const parentNavigation = (_event: unknown, _url: string, _inPlace: boolean, mainFrame: boolean) => { if (mainFrame) cancel(); };
    const timeout = setTimeout(cancel, PICKER_TIMEOUT_MS);
    active.set(picker.webContents.id, { window: picker, parent, choices: [], audioAvailable: input.audioRequested && process.platform === 'win32', loading: false, choosing: false, purpose: input.purpose, isRequestCurrent: input.isRequestCurrent ?? (() => true), finish });
    parent.once('closed', cancel);
    parent.webContents.on('did-start-navigation', parentNavigation);
    picker.once('closed', cancel);
    picker.webContents.once('render-process-gone', cancel);
    picker.webContents.on('before-input-event', (event, key) => { if (key.type === 'keyDown' && key.key === 'Escape') { event.preventDefault(); cancel(); } });
    picker.once('ready-to-show', () => { if (!finished && !picker.isDestroyed()) picker.show(); });
    const devUrl = process.env.VITE_DEV_SERVER_URL;
    const load = devUrl
      ? picker.loadURL(`${devUrl.replace(/\/$/, '')}/?view=display-media-picker`)
      : picker.loadFile(path.join(runtimeDir, '../dist/index.html'), { query: { view: 'display-media-picker' } });
    void Promise.resolve(load).catch(cancel);
  });
}
