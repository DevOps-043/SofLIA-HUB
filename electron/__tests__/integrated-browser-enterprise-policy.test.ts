import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BrowserEnterprisePolicyStore } from '../integrated-browser/enterprise-policy-store';

const roots: string[] = [];
afterEach(() => Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))));

async function store() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-policy-'));
  roots.push(root);
  return new BrowserEnterprisePolicyStore(path.join(root, 'policy.json'));
}

const valid = {
  version: 1,
  blockedOrigins: ['https://blocked.example'],
  forcedPrivacyLevel: 'strict',
  extensionsAllowed: false,
  agentAllowed: true,
  historyRetentionDays: 30,
};

describe('BrowserEnterprisePolicyStore', () => {
  it('recupera el respaldo y falla cerrado si todos los archivos están dañados', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-policy-recovery-'));
    roots.push(root);
    const destination = path.join(root, 'policy.json');
    const policies = new BrowserEnterprisePolicyStore(destination);
    await policies.apply(valid, 'org:17');
    await policies.apply({ ...valid, agentAllowed: false }, 'org:18');
    await fs.writeFile(destination, '{roto');
    expect((await policies.getStatus()).sourceRevision).toBe('org:18');
    expect((await new BrowserEnterprisePolicyStore(destination).getStatus()).sourceRevision).toBe('org:17');
    await fs.writeFile(destination + '.bak', '{roto');
    await expect(new BrowserEnterprisePolicyStore(destination).getStatus()).rejects.toThrow('bloqueado');
  });

  it('normaliza y conserva una política válida', async () => {
    const policies = await store();
    const status = await policies.apply(valid, 'org:17');
    expect(status).toMatchObject({ managed: true, sourceRevision: 'org:17', lastError: null });
    expect(status.policy?.blockedOrigins).toEqual(['https://blocked.example']);
  });

  it('conserva la última versión válida ante campos desconocidos', async () => {
    const policies = await store();
    await policies.apply(valid, 'org:17');
    const status = await policies.apply({ ...valid, script: 'borra todo' }, 'org:18');
    expect(status.sourceRevision).toBe('org:17');
    expect(status.lastError).toContain('campos no soportados');
  });

  it('rechaza orígenes con credenciales, rutas o esquemas locales', async () => {
    const policies = await store();
    for (const origin of ['file:///privado', 'https://u:p@example.com/', 'https://example.com/ruta']) {
      const status = await policies.apply({ ...valid, blockedOrigins: [origin] }, 'org:19');
      expect(status.managed).toBe(false);
    }
  });
});
