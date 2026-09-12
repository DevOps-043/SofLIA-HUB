import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserWindow, dialog, safeStorage } from 'electron';
import { BrowserCredentialTransfer } from '../integrated-browser/credential-transfer';
import { BrowserCredentialVault } from '../integrated-browser/credential-vault';

const roots: string[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true);
});

afterEach(async () => {
  for (const root of roots.splice(0)) await fs.rm(root, { recursive: true, force: true });
});

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-credential-transfer-'));
  roots.push(root);
  const vault = new BrowserCredentialVault(path.join(root, 'vault.json'));
  const context = { parent: new BrowserWindow() as BrowserWindow | null, assertCurrent: vi.fn() };
  return { root, vault, context, transfer: new BrowserCredentialTransfer(vault) };
}

describe('transferencia de credenciales con consentimiento', () => {
  it('prepara conflictos sin escribir y actualiza sólo tras commit', async () => {
    const f = await fixture();
    await f.vault.save('https://example.com', { username: 'cuenta', password: 'anterior-ficticia' });
    const prepared = await f.vault.prepareImport([
      { origin: 'https://example.com', username: 'cuenta', password: 'nueva-ficticia' },
      { origin: 'https://nuevo.example', username: 'otra', password: 'otra-ficticia' },
      { origin: 'https://nuevo.example', username: 'otra', password: 'duplicada' },
      { origin: 'file:///privado', username: 'x', password: 'x' },
    ]);
    expect(prepared.summary).toEqual({ total: 4, newCount: 1, conflictCount: 1, duplicateCount: 1, invalidCount: 1 });
    expect(JSON.stringify(prepared.summary)).not.toContain('ficticia');
    expect(await prepared.commit('update')).toEqual({ imported: 1, updated: 1, skipped: 0 });
    expect((await f.vault.resolveSecret((await f.vault.list('https://example.com'))[0].id, 'https://example.com')).password).toBe('nueva-ficticia');
    expect((await f.vault.list()).map((item) => item.username)).toEqual(['cuenta', 'otra']);
  });

  it('exporta sólo después de advertencia y destino explícitos sin devolver secretos al resultado', async () => {
    const f = await fixture();
    await f.vault.save('https://example.com', { username: 'cuenta', password: 'secreto-exportado' });
    const destination = path.join(f.root, 'export.json');
    vi.mocked(dialog.showMessageBox).mockResolvedValueOnce({ response: 1, checkboxChecked: false });
    vi.mocked(dialog.showSaveDialog).mockResolvedValueOnce({ canceled: false, filePath: destination });
    const result = await f.transfer.exportToDialog(f.context);
    expect(result).toEqual({ cancelled: false, exported: 1 });
    expect(JSON.stringify(result)).not.toContain('secreto-exportado');
    expect(JSON.parse(await fs.readFile(destination, 'utf8'))).toMatchObject({ version: 1, credentials: [{ username: 'cuenta', password: 'secreto-exportado' }] });
  });

  it('importa con revisión nativa y no escribe si se cancela', async () => {
    const f = await fixture();
    const source = path.join(f.root, 'import.json');
    await fs.writeFile(source, JSON.stringify({ version: 1, credentials: [{ origin: 'https://example.com', username: 'cuenta', password: 'secreto-importado' }] }));
    vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({ canceled: false, filePaths: [source] });
    vi.mocked(dialog.showMessageBox).mockResolvedValueOnce({ response: 1, checkboxChecked: false });
    expect(await f.transfer.importFromDialog(f.context)).toEqual({ cancelled: true });
    expect(await f.vault.list()).toEqual([]);
  });
});
