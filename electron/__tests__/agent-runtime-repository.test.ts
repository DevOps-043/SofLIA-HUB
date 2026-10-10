import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EncryptedRunRepository } from '../agent-runtime/repository';
import { AgentHarness } from '../agent-runtime/service';
describe('Historial del arnés', () => {
  it('no escribe contenido cuando el cifrado no está disponible', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'soflia-history-'));
    try {
      const repo = new EncryptedRunRepository(directory, { isEncryptionAvailable: () => false, encryptString: () => { throw new Error(); }, decryptString: () => { throw new Error(); } });
      repo.save({ userId: 'a', organizationId: null }, []);
      expect(fs.readdirSync(directory)).toEqual([]);
      expect(repo.load({ userId: 'a', organizationId: null })).toEqual([]);
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  });
  it('utiliza cifrado y separa archivos por usuario y organización', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'soflia-history-'));
    try {
      const repo = new EncryptedRunRepository(directory, {
        isEncryptionAvailable: () => true,
        encryptString: value => Buffer.from(Buffer.from(value).map(byte => byte ^ 0x5a)),
        decryptString: value => Buffer.from(Buffer.from(value).map(byte => byte ^ 0x5a)).toString(),
      });
      const scope = { userId: 'a', organizationId: 'org' };
      const harness = new AgentHarness({ repository: repo, authorize: async () => {}, provider: () => ({ execute: async () => ({ text: 'resultado', inputTokens: 0, outputTokens: 0 }) }), publish: async () => 'id' });
      harness.setScope(scope);
      await harness.start({ title: 'Privado', source: 'Transcripción privada', provider: 'gemini' });
      harness.close();
      expect(repo.load(scope)).toHaveLength(1);
      expect(repo.load({ userId: 'b', organizationId: 'org' })).toEqual([]);
      expect(repo.load({ userId: 'a', organizationId: 'otra' })).toEqual([]);
      expect(fs.readFileSync(path.join(directory, fs.readdirSync(directory)[0])).toString()).not.toContain('Transcripción privada');
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  });
});
