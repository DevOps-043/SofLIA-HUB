import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { app } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserWindow, ipcMain } from 'electron';
import { registerDesktopContextHandlers, safeDesktopContextError } from '../desktop-context-handlers';
import type { DesktopContextService } from '../desktop-context/service';
import { setAuthState } from '../main/auth-state';

type TestHandler = (event: { sender: { id: number }; senderFrame?: unknown }, input?: unknown) => Promise<{
  success: boolean;
  error?: string;
  inventory?: unknown;
  attachment?: unknown;
}>;

const ipcMainHarness = ipcMain as unknown as {
  _clearHandlers: () => void;
  _getHandlers: () => Map<string, TestHandler>;
};

describe('handlers del contexto de aplicaciones de escritorio', () => {
  const service = {
    clearInventory: vi.fn(),
    listApps: vi.fn(async () => ({ candidates: [], availableLevels: ['captura'], platform: 'win32' })),
    captureApp: vi.fn(async (appId: unknown) => {
      if (appId !== 'app-4321-abc123') throw new Error('Identificador de aplicacion invalido.');
      return { appId, title: 'Notas', appName: 'notepad', level: 'accesibilidad', source: 'Notas', text: 'hola', warnings: [], charCount: 4 };
    }),
  };

  let window: InstanceType<typeof BrowserWindow>;
  let registration: ReturnType<typeof registerDesktopContextHandlers>;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SOFLIA_DISABLE_DESKTOP_CONTEXT;
    ipcMainHarness._clearHandlers();
    window = new BrowserWindow();
    Object.defineProperty(window.webContents, 'mainFrame', { configurable: true, value: { url: pathToFileURL(path.join(app.getAppPath(), 'dist', 'index.html')).href } });
    registration = registerDesktopContextHandlers(service as unknown as DesktopContextService, () => window);
  });

  afterEach(() => {
    registration?.dispose();
    delete process.env.SOFLIA_DISABLE_DESKTOP_CONTEXT;
  });

  it('registra exactamente los dos canales de lectura', () => {
    const canales = Array.from(ipcMainHarness._getHandlers().keys())
      .filter((key) => String(key).startsWith('desktop-context:'));
    expect(canales.sort()).toEqual(['desktop-context:capture-app', 'desktop-context:list-apps']);
  });

  it('devuelve el inventario al emisor autorizado', async () => {
    const handler = ipcMainHarness._getHandlers().get('desktop-context:list-apps');
    const result = await handler!({ sender: window.webContents, senderFrame: window.webContents.mainFrame });

    expect(result.success).toBe(true);
    expect(result.inventory).toMatchObject({ platform: 'win32' });
  });
  it('un cambio A/B/A limpia inventario y descarta la carga pendiente', async () => {
    let finish!: (value: { candidates: never[]; availableLevels: string[]; platform: string }) => void;
    service.listApps.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const handler = ipcMainHarness._getHandlers().get('desktop-context:list-apps')!;
    const pending = handler({ sender: window.webContents, senderFrame: window.webContents.mainFrame });
    await vi.waitFor(() => expect(service.listApps).toHaveBeenCalled());
    setAuthState({ authenticated: true, userId: 'B' }); setAuthState({ authenticated: true, userId: 'test-user' });
    finish({ candidates: [], availableLevels: ['captura'], platform: 'win32' });
    expect(await pending).toMatchObject({ success: false }); expect(service.clearInventory).toHaveBeenCalledTimes(2);
  });

  it('extrae el contexto de una aplicacion inventariada', async () => {
    const handler = ipcMainHarness._getHandlers().get('desktop-context:capture-app');
    const result = await handler!({ sender: window.webContents, senderFrame: window.webContents.mainFrame }, { appId: 'app-4321-abc123' });

    expect(result.success).toBe(true);
    expect(result.attachment).toMatchObject({ level: 'accesibilidad', text: 'hola' });
    expect(service.captureApp).toHaveBeenCalledWith('app-4321-abc123', expect.objectContaining({ assertCurrent: expect.any(Function) }));
  });

  it('rechaza un identificador desconocido sin devolver contenido', async () => {
    const handler = ipcMainHarness._getHandlers().get('desktop-context:capture-app');
    const result = await handler!({ sender: window.webContents, senderFrame: window.webContents.mainFrame }, { appId: 'no-existe' });

    expect(result.success).toBe(false);
    expect(result.attachment).toBeUndefined();
  });

  it('rechaza un emisor que no es la ventana principal', async () => {
    const handler = ipcMainHarness._getHandlers().get('desktop-context:list-apps');
    const result = await handler!({ sender: { id: window.webContents.id + 99 } });

    expect(result).toMatchObject({ success: false, error: 'sender_denied' });
    expect(service.listApps).not.toHaveBeenCalled();
  });

  it('no registra los canales cuando la capacidad esta desactivada', () => {
    ipcMainHarness._clearHandlers();
    process.env.SOFLIA_DISABLE_DESKTOP_CONTEXT = '1';

    registration = registerDesktopContextHandlers(service as unknown as DesktopContextService, () => window);

    const canales = Array.from(ipcMainHarness._getHandlers().keys())
      .filter((key) => String(key).startsWith('desktop-context:'));
    expect(canales).toEqual([]);
  });
});

describe('saneamiento de errores', () => {
  it('elimina rutas de Windows del mensaje devuelto al renderer', () => {
    const mensaje = safeDesktopContextError(new Error('No se pudo leer C:\\Users\\ana\\Documentos\\secreto.xlsx'));
    expect(mensaje).not.toContain('ana');
    expect(mensaje).toContain('<ruta>');
  });

  it('elimina rutas POSIX y colapsa el mensaje a una linea', () => {
    const mensaje = safeDesktopContextError(new Error('fallo en /home/ana/docs/secreto.pdf\n\ttraza interna'));
    expect(mensaje).not.toContain('/home/ana');
    expect(mensaje).not.toContain('\n');
  });

  it('acota la longitud del mensaje', () => {
    expect(safeDesktopContextError(new Error('e'.repeat(500))).length).toBeLessThanOrEqual(240);
  });
});

