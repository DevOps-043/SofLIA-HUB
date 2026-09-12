import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { BrowserWindow, dialog, safeStorage } from 'electron';
import { BrowserAgentAuditStore } from '../integrated-browser/agent-audit-store';
import { IntegratedBrowserService } from '../integrated-browser/service';
import { readClipboardText } from '../clipboard-ai-assistant/history';

let directory: string;
let file: string;
let store: BrowserAgentAuditStore;
const input = () => ({ traceId: randomUUID(), tabId: 'tab-ficticia', url: 'https://usuario:clave@example.com/privado?token=secreto#contenido', operation: 'type' as const, result: 'completed' as const });
beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-audit-test-'));
  file = path.join(directory, 'audit.sqlite'); store = new BrowserAgentAuditStore(file);
  vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); fs.rmSync(directory, { recursive: true, force: true }); });

describe('bitácora cifrada del navegador', () => {
  it('conserva traza y origen sin guardar argumentos, formularios ni rutas', () => {
    const entry = input(); store.record(entry);
    const page = store.list();
    expect(page).toMatchObject({ total: 1, retentionDays: 30 });
    expect(page.entries[0]).toMatchObject({ origin: 'https://example.com', traceId: entry.traceId, operation: 'type', result: 'completed' });
    for (const forbidden of ['clave', 'secreto', 'contenido', 'privado', 'usuario', 'tab-ficticia']) {
      expect(JSON.stringify(page)).not.toContain(forbidden);
      expect(fs.readFileSync(file).toString()).not.toContain(forbidden);
    }
    expect(new BrowserAgentAuditStore(file).list()).toEqual(page);
  });
  it('pagina, expira y permite borrar sin resucitar entradas', () => {
    for (let i = 0; i < 55; i++) store.record(input());
    expect(store.list().entries).toHaveLength(50); expect(store.list(50).entries).toHaveLength(5);
    expect(() => store.list(-1)).toThrow(); expect(() => store.list(Infinity)).toThrow();
    expect(() => store.setRetention(2)).toThrow();
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 8 * 86_400_000);
    store.setRetention(7); expect(store.list().total).toBe(0);
    store.record(input()); store.clear(); expect(new BrowserAgentAuditStore(file).list().total).toBe(0);
  });
  it('rechaza corrupción, versiones futuras, otro perfil y cifrado indisponible', () => {
    store.record(input());
    const other = path.join(directory, 'otro', 'audit.sqlite'); fs.mkdirSync(path.dirname(other));
    fs.copyFileSync(file, other); expect(() => new BrowserAgentAuditStore(other).list()).toThrow('cifrada');
    const db = new DatabaseSync(file); db.exec("UPDATE events SET payload='alterado'"); db.close();
    expect(() => store.list()).toThrow('cifrada');
    const future = new DatabaseSync(file); future.exec('PRAGMA user_version=99'); future.close();
    expect(() => store.list()).toThrow('cifrada');
    const inspect = new DatabaseSync(file); expect(inspect.prepare('PRAGMA user_version').get()?.user_version).toBe(99); inspect.close();
    vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(false);
    expect(() => store.clear()).toThrow('cifrada');
  });
  it('rechaza operaciones o resultados no declarados antes de abrir el archivo', () => {
    expect(() => store.record({ ...input(), operation: 'secreto' as never })).toThrow();
    expect(() => store.record({ ...input(), result: 'secreto' as never })).toThrow();
    expect(fs.existsSync(file)).toBe(false);
  });
  it.each(['confirm', 'cancel', 'control', 'window', 'error', 'expired'] as const)('borrado y retención sólo con HITL vigente: %s', async (mode) => {
    const browser = new IntegratedBrowserService(); browser.attachWindow(new BrowserWindow());
    const clear = vi.spyOn(BrowserAgentAuditStore.prototype, 'clear').mockImplementation(() => undefined);
    vi.mocked(dialog.showMessageBox).mockImplementationOnce(async () => {
      expect(clear).not.toHaveBeenCalled();
      if (mode === 'control') {
        (browser as unknown as { setAgentControlling: (active: boolean) => void }).setAgentControlling(true);
        browser.releaseAgentControl();
      }
      if (mode === 'window') browser.detachWindow();
      if (mode === 'expired') vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 5 * 60_000);
      if (mode === 'error') throw new Error('C:/privado/token');
      return { response: mode === 'cancel' ? 0 : 1, checkboxChecked: false };
    });
    try {
      if (mode === 'confirm' || mode === 'cancel') expect(await browser.changeAgentAudit('clear')).toEqual({ cancelled: mode === 'cancel' });
      else await expect(browser.changeAgentAudit('clear')).rejects.toThrow(mode === 'control' || mode === 'expired' ? 'Toma el control' : 'No se pudo modificar');
      expect(clear).toHaveBeenCalledTimes(mode === 'confirm' ? 1 : 0);
    } finally { browser.detachWindow(); }
  });
  it('registra inicio y resultado en orden sin incluir valor devuelto ni error', async () => {
    vi.stubEnv('BROWSER_AGENT_GOVERNANCE_ENABLED', 'true');
    const record = vi.spyOn(BrowserAgentAuditStore.prototype, 'record').mockImplementation(() => undefined);
    const browser = new IntegratedBrowserService(); browser.attachWindow(new BrowserWindow());
    try {
      expect(await browser.auditAgentOperation('dom', async () => 'Texto privado')).toBe('Texto privado');
      await expect(browser.auditAgentOperation('type', async () => { throw new Error('Contraseña privada'); })).rejects.toThrow('Contraseña');
      expect(record.mock.calls.map(([entry]) => entry.result)).toEqual(['started', 'completed', 'started', 'failed']);
      expect(record.mock.calls[0][0].traceId).toBe(record.mock.calls[1][0].traceId);
      expect(JSON.stringify(record.mock.calls)).not.toContain('privad');
      record.mockImplementation(() => { throw new Error('Disco no disponible'); });
      const action = vi.fn(async () => undefined);
      await expect(browser.auditAgentOperation('click', action)).rejects.toThrow('Disco');
      expect(action).not.toHaveBeenCalled();
    } finally { browser.detachWindow(); }
  });
  it('rechaza diálogos concurrentes y no recrea un contexto cerrado al terminar una operación', async () => {
    vi.stubEnv('BROWSER_AGENT_GOVERNANCE_ENABLED', 'true');
    const record = vi.spyOn(BrowserAgentAuditStore.prototype, 'record').mockImplementation(() => undefined);
    const clear = vi.spyOn(BrowserAgentAuditStore.prototype, 'clear').mockImplementation(() => undefined);
    const browser = new IntegratedBrowserService(); browser.attachWindow(new BrowserWindow());
    let confirm!: (value: { response: number; checkboxChecked: boolean }) => void;
    vi.mocked(dialog.showMessageBox).mockImplementationOnce(() => new Promise((resolve) => { confirm = resolve; }));
    try {
      const review = browser.changeAgentAudit('clear');
      await expect(browser.changeAgentAudit('retention', 7)).rejects.toThrow('pendiente');
      confirm({ response: 0, checkboxChecked: false });
      expect(await review).toEqual({ cancelled: true }); expect(clear).not.toHaveBeenCalled();
      await expect(browser.auditAgentOperation('dom', async () => { browser.detachWindow(); return 'privado'; })).rejects.toThrow();
      expect(record.mock.calls.map(([entry]) => entry.result)).toEqual(['started']);
    } finally { browser.detachWindow(); }
  });
  it('comparte la traza entre operaciones anidadas y no escribe con la capacidad apagada', async () => {
    vi.stubEnv('BROWSER_AGENT_GOVERNANCE_ENABLED', 'true');
    const record = vi.spyOn(BrowserAgentAuditStore.prototype, 'record').mockImplementation(() => undefined);
    const browser = new IntegratedBrowserService(); browser.attachWindow(new BrowserWindow());
    try {
      await browser.auditAgentOperation('cu-capture', () => browser.auditAgentOperation('capture', async () => undefined));
      expect(record).toHaveBeenCalledTimes(4);
      expect(new Set(record.mock.calls.map(([entry]) => entry.traceId)).size).toBe(1);
      record.mockClear(); vi.stubEnv('BROWSER_AGENT_GOVERNANCE_ENABLED', 'false');
      const disabled = new IntegratedBrowserService();
      await disabled.auditAgentOperation('dom', async () => undefined);
      expect(record).not.toHaveBeenCalled();
    } finally { browser.detachWindow(); }
  });
  it('acepta portapapeles síncrono estable y asíncrono sin perder el manejo de fallos', async () => {
    expect(await readClipboardText({ readText: () => 'prueba' })).toBe('prueba');
    expect(await readClipboardText({ readText: async () => 'prueba' })).toBe('prueba');
    expect(await readClipboardText({ readText: () => { throw new Error('bloqueado'); } })).toBe('');
    expect(await readClipboardText({ readText: async () => { throw new Error('bloqueado'); } })).toBe('');
  });
});
