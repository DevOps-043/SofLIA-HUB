import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { BrowserWindow, dialog, safeStorage } from 'electron';
import { BrowserAgentShortcutStore } from '../integrated-browser/agent-shortcut-store';
import { IntegratedBrowserService } from '../integrated-browser/service';
import { browserScopeIdFor, setBrowserScopeId, resetBrowserScopeForTests } from '../integrated-browser/profile-scope';
import { validateBrowserShortcutRequest, type BrowserAgentShortcut } from '../../src/shared/browser-agent-shortcuts';

const entry = (): BrowserAgentShortcut => ({ id: '', title: 'Comparar contratos', instruction: 'Compara sólo los fragmentos adjuntos.', scope: 'selected-tabs', permission: 'read-fragments' });
let directory: string; let file: string; let store: BrowserAgentShortcutStore;
const list = { action: 'list', profileRevision: 0 } as const;
beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-shortcuts-')); file = path.join(directory, 'shortcuts.bin');
  store = new BrowserAgentShortcutStore(file); vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); resetBrowserScopeForTests(); fs.rmSync(directory, { recursive: true, force: true }); });

describe('Atajos cifrados y gobernados', () => {
  it('crea, reabre, edita y elimina usando la protección del SO', async () => {
    const first = await store.run({ ...list, action: 'save', revision: 0, entry: entry() }, () => {});
    // El doble global de safeStorage no cifra; se comprueba el cableado, no criptografía nativa.
    const encryptionResults = vi.mocked(safeStorage.encryptString).mock.results;
    expect(fs.readFileSync(file)).toEqual(encryptionResults[encryptionResults.length - 1]?.value);
    expect(await new BrowserAgentShortcutStore(file).run(list, () => {})).toEqual(first);
    const updated = await store.run({ ...list, action: 'save', revision: 1, entry: { ...first.entries[0], title: 'Resumen' } }, () => {});
    expect(updated).toMatchObject({ revision: 2, entries: [{ title: 'Resumen' }] });
    expect((await store.run({ ...list, action: 'remove', revision: 2, id: first.entries[0].id }, () => {})).entries).toEqual([]);
    expect((await store.run(list, () => {})).revision).toBe(3);
  });

  it('rechaza revisión obsoleta e ID ajeno sin cambiar el archivo', async () => {
    const first = await store.run({ ...list, action: 'save', revision: 0, entry: entry() }, () => {}); const bytes = fs.readFileSync(file);
    await expect(store.run({ ...list, action: 'save', revision: 0, entry: entry() }, () => {})).rejects.toThrow('cambiaron');
    await expect(store.run({ ...list, action: 'save', revision: 1, entry: { ...entry(), id: '00000000-0000-0000-0000-000000000000' } }, () => {})).rejects.toThrow('existe');
    expect(fs.readFileSync(file)).toEqual(bytes); expect(first.entries).toHaveLength(1);
  });

  it.each([
    { action: 'execute', profileRevision: 0 }, { ...list, path: 'privado' }, { action: 'list' },
    { ...list, action: 'save', revision: 0, entry: { ...entry(), permission: 'act' } },
    { ...list, action: 'save', revision: 0, entry: { ...entry(), scope: 'all-tabs' } },
    { ...list, action: 'save', revision: 0, entry: { ...entry(), instruction: 'x'.repeat(5001) } },
  ])('rechaza contrato ampliado o inválido antes de E/S: %#', input => {
    expect(() => validateBrowserShortcutRequest(input)).toThrow(); expect(fs.existsSync(file)).toBe(false);
  });

  it('falla cerrado ante corrupción, otro ámbito o cifrado indisponible', async () => {
    await store.run({ ...list, action: 'save', revision: 0, entry: entry() }, () => {});
    const other = path.join(directory, 'other.bin'); fs.copyFileSync(file, other);
    await expect(new BrowserAgentShortcutStore(other).run(list, () => {})).rejects.toThrow('cifrados');
    fs.writeFileSync(file, 'dañado');
    await expect(store.run({ ...list, action: 'save', revision: 0, entry: entry() }, () => {})).rejects.toThrow('cifrados');
    expect(fs.readFileSync(file, 'utf8')).toBe('dañado');
    vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(false);
    await expect(store.run(list, () => {})).rejects.toThrow('cifrados');
  });

  it('cuota y guarda de commit conservan la instantánea previa', async () => {
    for (let revision = 0; revision < 50; revision++) await store.run({ ...list, action: 'save', revision, entry: entry() }, () => {});
    const bytes = fs.readFileSync(file);
    await expect(store.run({ ...list, action: 'save', revision: 50, entry: entry() }, () => {})).rejects.toThrow('50');
    let calls = 0;
    const existing = (await store.run(list, () => {})).entries[0];
    await expect(store.run({ ...list, action: 'save', revision: 50, entry: { ...existing, title: 'Cambio' } }, () => { if (++calls === 4) throw new Error('Perfil cambió'); })).rejects.toThrow();
    expect(fs.readFileSync(file)).toEqual(bytes); expect(fs.readdirSync(directory).filter(name => name.endsWith('.tmp'))).toEqual([]);
  });

  it('conserva versiones futuras y el original si falla publicar el temporal', async () => {
    await store.run({ ...list, action: 'save', revision: 0, entry: entry() }, () => {});
    const original = fs.readFileSync(file);
    const rename = vi.spyOn(fsp, 'rename').mockRejectedValueOnce(new Error('ruta privada'));
    await expect(store.run({ ...list, action: 'save', revision: 1, entry: entry() }, () => {})).rejects.toThrow('cifrados');
    expect(fs.readFileSync(file)).toEqual(original); rename.mockRestore();
    const future = { ...JSON.parse(safeStorage.decryptString(original)), version: 99 };
    fs.writeFileSync(file, safeStorage.encryptString(JSON.stringify(future)));
    const futureBytes = fs.readFileSync(file);
    await expect(store.run(list, () => {})).rejects.toThrow('cifrados');
    expect(fs.readFileSync(file)).toEqual(futureBytes);
  });

  it.each(['cancelar', 'aprobar', 'cambiar', 'expirar'] as const)('la eliminación requiere consentimiento vigente: %s', async mode => {
    vi.stubEnv('BROWSER_AGENT_GOVERNANCE_ENABLED', 'true'); setBrowserScopeId(browserScopeIdFor('cuenta-ficticia'));
    const browser = new IntegratedBrowserService(); browser.attachWindow(new BrowserWindow());
    const run = vi.spyOn(BrowserAgentShortcutStore.prototype, 'run').mockResolvedValue({ revision: 2, entries: [] });
    vi.mocked(dialog.showMessageBox).mockImplementationOnce(async () => {
      expect(run).not.toHaveBeenCalled();
      if (mode === 'cambiar') setBrowserScopeId(browserScopeIdFor('otra-cuenta'));
      if (mode === 'expirar') vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 300_001);
      return { response: mode === 'cancelar' ? 0 : 1, checkboxChecked: false };
    });
    const result = browser.agentShortcuts({ action: 'remove', profileRevision: browser.getState().profileRevision!, revision: 1, id: '00000000-0000-0000-0000-000000000000' });
    if (mode === 'cambiar' || mode === 'expirar') { await expect(result).rejects.toThrow(); expect(run).not.toHaveBeenCalled(); }
    else { expect(await result).toMatchObject(mode === 'cancelar' ? { canceled: true } : { success: true }); expect(run).toHaveBeenCalledTimes(mode === 'cancelar' ? 0 : 1); }
  });

  it('rechaza perfil invitado, revisión de otro perfil y capacidad apagada', async () => {
    const run = vi.spyOn(BrowserAgentShortcutStore.prototype, 'run');
    const disabled = new IntegratedBrowserService(); disabled.attachWindow(new BrowserWindow());
    await expect(disabled.agentShortcuts(list)).rejects.toThrow();
    vi.stubEnv('BROWSER_AGENT_GOVERNANCE_ENABLED', 'true');
    const browser = new IntegratedBrowserService(); browser.attachWindow(new BrowserWindow());
    await expect(browser.agentShortcuts(list)).rejects.toThrow();
    setBrowserScopeId(browserScopeIdFor('cuenta-ficticia'));
    await expect(browser.agentShortcuts({ ...list, profileRevision: 999 })).rejects.toThrow();
    expect(run).not.toHaveBeenCalled();
  });
});
