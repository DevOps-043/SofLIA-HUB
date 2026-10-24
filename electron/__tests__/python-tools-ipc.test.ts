import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app, dialog, ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { registerPythonToolsHandlers } from '../python-tools-handlers';
import type { PythonToolsService } from '../python-tools-service';
import { resetAuthStateForTests, setAuthState } from '../main/auth-state';
import { deferred } from './project-hub/fixtures';
import { exposePythonToolsApi } from '../preload/python-tools-api';
import { createSafeIpc } from '../preload/safe-ipc';
import type { PythonToolsApi } from '../../src/shared/python-tools';
const harness = ipcMain as unknown as { _getHandler(channel: string): (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<Record<string, unknown>> };
let root: string; let original: string; let sender: EventEmitter & { mainFrame: { url: string }; isDestroyed(): boolean }; let event: IpcMainInvokeEvent;
let config = { redactDocuments: false }; let revision = 0;
let registration: ReturnType<typeof registerPythonToolsHandlers>;
const service = {
  getStatus: vi.fn(), getPrivacyConfig: vi.fn(() => ({ ...config })), capturePrivacyContext: vi.fn(() => { const version = revision; return { config: { ...config }, assertCurrent: () => { if (version !== revision) throw new Error('PRIVACY_CHANGED'); } }; }),
  setPrivacyConfig: vi.fn((next: typeof config) => { config = next; revision++; return { ...config }; }),
  stop: vi.fn(async () => {}), parseDocument: vi.fn(), redactText: vi.fn(async () => ({ success: true, data: { redacted: '[EMAIL]', entities: [], engine: 'soflia-regex-mx', redactedCount: 0 } })),
  releaseDocumentCopy: vi.fn(async (remove: () => Promise<void>) => { await remove(); return true; }),
};
const invoke = (channel: string, ...args: unknown[]) => harness._getHandler(channel)(event, ...args);
beforeEach(() => {
  vi.clearAllMocks(); resetAuthStateForTests(); setAuthState({ authenticated: true, userId: 'A' }); config = { redactDocuments: false }; revision = 0;
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'soflia-tools-ipc-')); original = path.join(root, 'elegido.pdf'); fs.writeFileSync(original, '%PDF-1.7\ncontenido-ficticio');
  vi.spyOn(app, 'getPath').mockImplementation(() => root);
  sender = Object.assign(new EventEmitter(), { mainFrame: { url: pathToFileURL(path.join(app.getAppPath(), 'dist', 'index.html')).href }, isDestroyed: () => false });
  const window = { webContents: sender, isDestroyed: () => false } as unknown as BrowserWindow;
  event = { sender, senderFrame: sender.mainFrame } as unknown as IpcMainInvokeEvent;
  service.getStatus.mockReturnValue({ available: true, running: false, privacy: { ...config }, lastError: 'C:/privado/secreto' });
  service.parseDocument.mockImplementation(async (file: string) => { expect(file).not.toBe(original); expect(fs.readFileSync(file)).toEqual(fs.readFileSync(original)); return { success: true, data: { markdown: 'Contenido ficticio', tables: [], metadata: { format: 'pdf' } } }; });
  vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: [original] }); vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 1, checkboxChecked: false });
  registration = registerPythonToolsHandlers(service as unknown as PythonToolsService, () => window);
});
afterEach(() => { registration.dispose(); resetAuthStateForTests(); vi.restoreAllMocks(); expect(path.relative(os.tmpdir(), root).startsWith('..')).toBe(false); fs.rmSync(root, { recursive: true, force: true }); });
describe('Frontera IPC documental Python', () => {
  it.each(['pytools:status', 'pytools:get-privacy-config', 'pytools:set-privacy-config', 'pytools:redact-text', 'pytools:parse-document'])('niega %s sin sesión antes de efectos', async channel => {
    setAuthState({ authenticated: false, userId: null }); vi.clearAllMocks(); expect(await invoke(channel)).toMatchObject({ success: false });
    expect(service.getStatus).not.toHaveBeenCalled(); expect(service.getPrivacyConfig).not.toHaveBeenCalled(); expect(service.parseDocument).not.toHaveBeenCalled(); expect(dialog.showOpenDialog).not.toHaveBeenCalled();
  });
  it.each(['subframe', 'origen', 'ventana'] as const)('niega %s antes del selector', async mode => {
    if (mode === 'subframe') event = { ...event, senderFrame: {} } as IpcMainInvokeEvent;
    if (mode === 'origen') sender.mainFrame.url = 'https://ajeno.example.test';
    if (mode === 'ventana') event = { ...event, sender: Object.assign(new EventEmitter(), { isDestroyed: () => false }) } as IpcMainInvokeEvent;
    expect(await invoke('pytools:parse-document')).toMatchObject({ success: false }); expect(dialog.showOpenDialog).not.toHaveBeenCalled(); expect(sender.eventNames()).toEqual([]);
  });
  it.each([
    ['pytools:parse-document', ['C:/ruta-no-autorizada.pdf']], ['pytools:redact-text', [{}]], ['pytools:redact-text', ['x'.repeat(400001)]],
    ['pytools:set-privacy-config', [{ redactDocuments: 'true' }]], ['pytools:set-privacy-config', [{ redactDocuments: true, approved: true }]],
    ['pytools:set-privacy-config', [{}]], ['pytools:status', ['extra']],
  ])('rechaza entrada de %s sin coerciones', async (channel, args) => {
    expect(await invoke(channel as string, ...args as unknown[])).toMatchObject({ success: false }); expect(service.setPrivacyConfig).not.toHaveBeenCalled(); expect(service.redactText).not.toHaveBeenCalled(); expect(dialog.showOpenDialog).not.toHaveBeenCalled();
  });
  it('lee la copia del selector y conserva el original sin rutas en la respuesta', async () => {
    const result = await invoke('pytools:parse-document'); expect(result).toMatchObject({ success: true, document: { markdown: 'Contenido ficticio' } });
    expect(JSON.stringify(result)).not.toContain(root); expect(fs.readdirSync(root)).toEqual(['elegido.pdf']); expect(sender.eventNames()).toEqual([]);
  });
  it('cancelar selector no invoca parser', async () => {
    vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({ canceled: true, filePaths: [] }); expect(await invoke('pytools:parse-document')).toMatchObject({ cancelled: true }); expect(service.parseDocument).not.toHaveBeenCalled();
  });
  it('A/B/A libera al caller pero no abre otro selector hasta cerrar el pendiente', async () => {
    const picker = deferred<{ canceled: boolean; filePaths: string[] }>(); vi.mocked(dialog.showOpenDialog).mockReturnValueOnce(picker.promise);
    const pending = invoke('pytools:parse-document'); await vi.waitFor(() => expect(dialog.showOpenDialog).toHaveBeenCalledOnce());
    setAuthState({ authenticated: true, userId: 'B' }); setAuthState({ authenticated: true, userId: 'A' }); expect(await pending).toMatchObject({ success: false });
    expect(await invoke('pytools:parse-document')).toMatchObject({ success: false, code: 'SIDECAR_BUSY' }); picker.resolve({ canceled: false, filePaths: [original] }); await Promise.resolve();
    expect(service.parseDocument).not.toHaveBeenCalled();
  });
  it('no entrega documento si cambia política durante parser', async () => {
    const result = deferred<{ success: boolean; data: object }>(); service.parseDocument.mockReturnValueOnce(result.promise);
    const pending = invoke('pytools:parse-document'); await vi.waitFor(() => expect(service.parseDocument).toHaveBeenCalledOnce()); revision++;
    result.resolve({ success: true, data: { markdown: 'anterior', tables: [], metadata: {} } }); expect(await pending).toMatchObject({ success: false, code: 'PRIVACY_CHANGED' }); expect(fs.readdirSync(root)).toEqual(['elegido.pdf']);
  });
  it('desactivar exige confirmación y cancelarla no escribe', async () => {
    config = { redactDocuments: true }; vi.mocked(dialog.showMessageBox).mockResolvedValueOnce({ response: 0, checkboxChecked: false });
    expect(await invoke('pytools:set-privacy-config', { redactDocuments: false })).toMatchObject({ success: false, cancelled: true }); expect(service.setPrivacyConfig).not.toHaveBeenCalled();
  });
  it('preload y safeIpc conservan cinco operaciones sin ruta renderer', async () => {
    let bridge!: PythonToolsApi;
    const ipc = createSafeIpc({ invoke: (channel, ...args) => harness._getHandler(channel)(event, ...args), send: vi.fn(), on: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() });
    exposePythonToolsApi({ exposeInMainWorld: (_name, value) => { bridge = value as PythonToolsApi; } }, ipc);
    expect(await bridge.parseDocument()).toMatchObject({ success: true }); expect(await bridge.redactText('ficticio')).toMatchObject({ success: true });
    const legacy = bridge.parseDocument as unknown as (file: string) => ReturnType<PythonToolsApi['parseDocument']>;
    expect(await legacy(original)).toMatchObject({ success: false, code: 'TOOLS_INVALID_INPUT' });
    expect(await bridge.getStatus()).toMatchObject({ success: true }); expect(await bridge.getPrivacyConfig()).toMatchObject({ success: true }); expect(await bridge.setPrivacyConfig({ redactDocuments: true })).toMatchObject({ success: true });
    expect(() => ipc.safeInvoke('pytools:run-command', {})).toThrow();
  });
});
