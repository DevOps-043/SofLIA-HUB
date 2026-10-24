import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { WhatsAppConversationHistoryStore, type WhatsAppConversationHistoryInput } from '../whatsapp/history';

let root: string, file: string;
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-tool-history-')); file = path.join(root, 'history.jsonl'); });
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });
const secret = 'dato-privado-ficticio';
const event = (): WhatsAppConversationHistoryInput => ({ direction: 'system', kind: 'tool', jid: 'ficticio@s.whatsapp.net', isGroup: false,
  source: 'tool-loop', text: secret, media: { fileName: secret },
  tool: { names: ['gmail_modify_labels'], summary: [{ name: 'gmail_modify_labels', success: false, partial: true,
    processed: 100, uncertain: true, error: secret, message: secret, session_id: secret, args: { payload: secret } }] },
  metadata: { toolSignature: secret, nested: { value: secret }, correlationId: '12345678-1234-4234-9234-123456789abc', durationMs: 12 } });
describe('Historial operativo WhatsApp con disco real temporal', () => {
  it('guarda únicamente estado, progreso y correlación, sin payload privado', async () => {
    const store = new WhatsAppConversationHistoryStore(file);
    const result = await store.append(event());
    expect(result?.tool?.summary[0]).toMatchObject({ success: false, partial: true, processed: 100, uncertain: true });
    expect(await fs.readFile(file, 'utf8')).not.toContain(secret);
    expect(result?.metadata).toEqual({ correlationId: '12345678-1234-4234-9234-123456789abc', durationMs: 12 });
    expect(result?.text).toBeUndefined(); expect(result?.media).toBeUndefined();
  });
  it('proyecta legado antes de buscar o devolver sin reescribir bytes', async () => {
    const legacy = JSON.stringify({ ...event(), id: 'legacy', timestamp: '2026-10-22T12:00:00Z' }) + '\n';
    await fs.writeFile(file, legacy);
    const store = new WhatsAppConversationHistoryStore(file);
    expect(JSON.stringify(await store.list())).not.toContain(secret);
    expect(await store.list({ query: secret })).toEqual([]);
    expect((await store.list({ query: 'gmail_modify_labels' }))).toHaveLength(1);
    expect(await fs.readFile(file, 'utf8')).toBe(legacy);
  });
  it('conserva conversación no-tool y sus filtros/estadísticas', async () => {
    const store = new WhatsAppConversationHistoryStore(file);
    await store.append({ direction: 'incoming', kind: 'text', jid: 'ficticio@s.whatsapp.net', isGroup: false, source: 'whatsapp-service', text: 'Texto de conversación ficticio' });
    expect((await store.list({ query: 'conversación' }))[0].text).toContain('conversación');
    expect(await store.getStats()).toMatchObject({ total: 1, incoming: 1, text: 1, tool: 0 });
  });
  it('omite campos libres y nombres inválidos aun cuando omiten al productor', async () => {
    const input = event(); input.tool = { names: ['privado@example.test', 'x'.repeat(500)], summary: [{ name: 'correo@example.test', status: secret, session_status: secret, count: Infinity, hasError: true }] };
    const store = new WhatsAppConversationHistoryStore(file); await store.append(input);
    const output = await store.list();
    expect(output[0].tool?.names).toEqual(['herramienta_desconocida', 'herramienta_desconocida']);
    expect(output[0].tool?.summary).toEqual([{ name: 'herramienta_desconocida', hasError: true }]);
    expect(await fs.readFile(file, 'utf8')).not.toContain(secret);
  });
});
