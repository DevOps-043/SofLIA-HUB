import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BrowserAgentPolicyStore } from '../integrated-browser/agent-policy-store';

const roots: string[] = [];
afterEach(() => Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))));
async function store() { const root = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-agent-policy-')); roots.push(root); return new BrowserAgentPolicyStore(path.join(root, 'policies.json')); }

describe('BrowserAgentPolicyStore', () => {
  it('permite lectura equilibrada pero solicita aprobación antes de actuar', async () => {
    const policies = await store();
    expect(await policies.evaluate('https://example.com/page', 'observe-dom')).toBe('ask');
    await policies.set({ origin: 'https://example.com', mode: 'balanced', decision: 'ask' });
    expect(await policies.evaluate('https://example.com/page', 'observe-dom')).toBe('allow');
    expect(await policies.evaluate('https://example.com/page', 'act')).toBe('ask');
  });

  it('persiste permitir siempre o bloquear por origen', async () => {
    const policies = await store();
    await policies.set({ origin: 'https://example.com/a', mode: 'strict', decision: 'allow-always' });
    expect(await policies.evaluate('https://example.com/b', 'capture')).toBe('allow');
    await policies.set({ origin: 'https://example.com', mode: 'balanced', decision: 'block' });
    expect(await policies.evaluate('https://example.com', 'read-document')).toBe('block');
  });

  it('rechaza esquemas no web y la decisión transitoria como persistencia', async () => {
    const policies = await store();
    await expect(policies.set({ origin: 'file:///secreto', mode: 'strict', decision: 'block' })).rejects.toThrow();
    await expect(policies.set({ origin: 'https://example.com', mode: 'strict', decision: 'allow-once' })).rejects.toThrow();
  });
});
