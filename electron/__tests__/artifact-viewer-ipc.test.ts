import { afterEach, expect, it, vi } from 'vitest';
import { ipcMain, dialog, shell, type BrowserWindow } from 'electron';
import { registerArtifactViewerHandlers } from '../artifact-viewer';
import { exposeArtifactViewerApi } from '../preload/artifact-viewer-api';
import { ALLOWED_IPC_CHANNELS } from '../preload/channels';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

afterEach(() => vi.restoreAllMocks());
function fixture() {
  const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
  vi.mocked(ipcMain.handle).mockImplementation((channel, handler) => { handlers.set(channel, handler as never); });
  const frame = {}; const contents = { mainFrame: frame, on: vi.fn(), off: vi.fn(), isDestroyed: () => false };
  const window = { webContents: contents, isDestroyed: () => false } as unknown as BrowserWindow;
  const service = { guard: vi.fn(async () => 1), preview: vi.fn(async () => ({ name: 'propuesta.md' })), selected: vi.fn(), clear: vi.fn(), resolve: vi.fn(), externalCopy: vi.fn(async () => 'C:/copia-temporal/propuesta.md') };
  const close = registerArtifactViewerHandlers(service as never, () => window);
  return { service, close, invoke: (name: string, payload?: unknown, senderFrame = frame) => handlers.get('artifact-viewer:' + name)!({ sender: contents, senderFrame }, payload) };
}
const reference = { kind: 'local', id: '4bc25420-46e1-4a93-9886-faf34152758a' };
it('valida frame y rechaza rutas o campos extra antes de leer', async () => {
  const test = fixture();
  expect(await test.invoke('preview', { ...reference, path: 'C:/privado.txt' })).toMatchObject({ success: false });
  expect(await test.invoke('preview', reference, {})).toMatchObject({ success: false });
  expect(test.service.preview).not.toHaveBeenCalled();
  expect(await test.invoke('preview', reference)).toMatchObject({ success: true }); test.close();
});
it('cancelar el selector no abre ni registra archivos', async () => {
  const test = fixture(); vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: true, filePaths: [] });
  expect(await test.invoke('pick')).toEqual({ success: true, data: null });
  expect(test.service.selected).not.toHaveBeenCalled(); test.close();
});
it('el selector devuelve un ID opaco y descarta cambios de contexto', async () => {
  const test = fixture(); vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: ['C:/archivo.md'] });
  test.service.selected.mockResolvedValue({ reference, name: 'archivo.md' });
  expect(await test.invoke('pick')).toMatchObject({ success: true, data: { reference } });
  test.service.guard.mockRejectedValueOnce(new Error('La sesión cambió.'));
  expect(await test.invoke('pick')).toMatchObject({ success: false }); test.close();
});
it('abrir fuera necesita el comando explícito y conserva HTML en el sandbox', async () => {
  const test = fixture(); vi.mocked(shell.openPath).mockResolvedValue('');
  test.service.resolve.mockResolvedValue({ file: 'C:/propuesta.md', metadata: { extension: 'md' }, token: 1 });
  expect(await test.invoke('open-external', reference)).toEqual({ success: true, data: null });
  expect(shell.openPath).toHaveBeenCalledWith('C:/copia-temporal/propuesta.md'); expect(test.service.externalCopy).toHaveBeenCalled(); vi.mocked(shell.openPath).mockClear();
  test.service.resolve.mockResolvedValue({ metadata: { extension: 'html' }, token: 1 });
  expect(await test.invoke('open-external', reference)).toMatchObject({ success: false }); expect(shell.openPath).not.toHaveBeenCalled(); test.close();
});
it('preload expone solamente los cuatro métodos de dominio allowlisted', () => {
  const expose = vi.fn(); const invoke = vi.fn(); exposeArtifactViewerApi({ exposeInMainWorld: expose }, { safeInvoke: invoke } as never);
  const api = expose.mock.calls[0][1]; api.preview(reference); api.pick(); api.saveCopy(reference); api.openExternal(reference);
  for (const action of ['preview', 'pick', 'save-copy', 'open-external']) expect(ALLOWED_IPC_CHANNELS).toContain('artifact-viewer:' + action);
  expect(invoke).toHaveBeenCalledWith('artifact-viewer:preview', reference);
  expect(Object.keys(api)).toHaveLength(4); expect(ALLOWED_IPC_CHANNELS).not.toContain('artifact-viewer:read-path');
});
it('guarda una copia autorizada, respeta cancelación y nunca sobrescribe', async () => {
  const test = fixture(); const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-viewer-export-'));
  if (!path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep)) throw new Error('Carpeta de prueba fuera de alcance.');
  try {
    const destination = path.join(root, 'copia.md');
    test.service.resolve.mockResolvedValue({ file: path.join(root, 'original.md'), metadata: { name: 'propuesta.md', extension: 'md' }, buffer: Buffer.from('Contenido comprobado'), token: 1 });
    vi.mocked(dialog.showSaveDialog).mockResolvedValueOnce({ canceled: true, filePath: '' });
    expect(await test.invoke('save-copy', reference)).toEqual({ success: true, data: false });
    vi.mocked(dialog.showSaveDialog).mockResolvedValue({ canceled: false, filePath: destination });
    expect(await test.invoke('save-copy', reference)).toEqual({ success: true, data: true }); expect(await fs.readFile(destination, 'utf8')).toBe('Contenido comprobado');
    expect(await test.invoke('save-copy', reference)).toMatchObject({ success: false, error: expect.stringContaining('Ya existe') });
  } finally { test.close(); await fs.rm(root, { recursive: true, force: true }); }
});
