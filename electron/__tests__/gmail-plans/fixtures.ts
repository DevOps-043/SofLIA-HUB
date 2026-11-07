import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import { vi } from 'vitest';
import type { OsCipher } from '../../storage/os-cipher';
import { GmailPlanStore } from '../../gmail/plan-storage';
import { GmailService } from '../../gmail/service';
import type { CalendarService } from '../../calendar-service';
import type { GmailClient } from '../../gmail/types';
import type { PrivateGmailPlan } from '../../gmail/plan-schema';

export const owner = { userId: 'usuario-A', email: 'cuenta-a@example.test' };
export const guard = () => {};
export function cipher(): OsCipher {
  const key = randomBytes(32);
  return {
    available: vi.fn(async () => true),
    encrypt: vi.fn(async text => {
      const iv = randomBytes(12); const encoder = createCipheriv('aes-256-gcm', key, iv);
      return Buffer.concat([iv, encoder.update(text, 'utf8'), encoder.final(), encoder.getAuthTag()]);
    }),
    decrypt: vi.fn(async bytes => {
      const decoder = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12)); decoder.setAuthTag(bytes.subarray(-16));
      return { result: Buffer.concat([decoder.update(bytes.subarray(12, -16)), decoder.final()]).toString('utf8'), shouldReEncrypt: false };
    }),
  };
}
export function plan(count = 2): PrivateGmailPlan {
  return { id: 'gmail-plan-' + randomUUID(), createdAt: new Date().toISOString(), queryUsed: 'in:inbox', removeFromInbox: true,
    minGroupSize: 1, scannedMessages: count, truncated: false, status: 'preview',
    groups: count ? [{ groupKey: 'domain:empresa.test', labelName: 'Empresa', count, messageIds: Array.from({ length: count }, (_, index) => 'msg-' + index) }] : [] };
}

export function fixture(root: string, options: { store?: GmailPlanStore; count?: number; crypto?: OsCipher } = {}) {
  const crypto = options.crypto ?? cipher();
  const store = options.store ?? new GmailPlanStore({ root: () => root, cipher: crypto });
  const current = new Map<string, string[]>(Array.from({ length: options.count ?? 2 }, (_, index) => ['msg-' + index, ['INBOX']]));
  const labels = new Map([['INBOX', { id: 'INBOX', name: 'INBOX' }]]);
  let nextLabel = 0;
  const apply = (id: string, add: string[] = [], remove: string[] = []) => { current.set(id, [...new Set([...(current.get(id) ?? []).filter(label => !remove.includes(label)), ...add])]); };
  const list = vi.fn(async (args: { labelIds?: string[]; maxResults?: number; pageToken?: string }) => {
    const ids = [...current].filter(([, values]) => !args.labelIds || args.labelIds.every(id => values.includes(id))).map(([id]) => id);
    const offset = Number(args.pageToken ?? 0); const max = args.maxResults ?? 100;
    return { data: { messages: ids.slice(offset, offset + max).map(id => ({ id })), resultSizeEstimate: ids.length,
      ...(offset + max < ids.length ? { nextPageToken: String(offset + max) } : {}) } };
  });
  const get = vi.fn(async ({ id }: { id: string }) => ({ data: { id, threadId: id, labelIds: current.get(id), internalDate: '1700000000000',
    payload: { headers: [{ name: 'From', value: 'Persona <persona@empresa.test>' }, { name: 'Subject', value: 'Asunto privado de prueba' }], mimeType: 'text/plain' } } }));
  const batchModify = vi.fn(async ({ requestBody }: { requestBody: { ids: string[]; addLabelIds?: string[]; removeLabelIds?: string[] } }) => {
    for (const id of requestBody.ids) apply(id, requestBody.addLabelIds, requestBody.removeLabelIds); return { data: {} };
  });
  const modify = vi.fn(async ({ id, requestBody }: { id: string; requestBody: { addLabelIds?: string[]; removeLabelIds?: string[] } }) => {
    apply(id, requestBody.addLabelIds, requestBody.removeLabelIds); return { data: {} };
  });
  const createLabel = vi.fn(async ({ requestBody }: { requestBody: { name: string } }) => {
    const label = { id: 'Label_' + ++nextLabel, name: requestBody.name }; labels.set(label.id, label); return { data: label };
  });
  const deleteLabel = vi.fn(async ({ id }: { id: string }) => {
    labels.delete(id); for (const [messageId, values] of current) current.set(messageId, values.filter(value => value !== id)); return { data: {} };
  });
  const sdk = { users: { messages: { list, get, batchModify, modify }, labels: { list: vi.fn(async () => ({ data: { labels: [...labels.values()] } })), create: createLabel, delete: deleteLabel } } };
  const calendar = { userId: owner.userId, contextRevision: 1,
    connections: new Map([['google', { provider: 'google', userId: owner.userId, email: owner.email, isActive: true }]]) } as unknown as CalendarService;
  const service = new GmailService(calendar, store);
  const client = sdk as unknown as GmailClient;
  const acquire = vi.spyOn(service, 'getClient').mockResolvedValue({ client });
  const auth = { userId: owner.userId, assertCurrent: vi.fn(), approve: vi.fn<(detail: string, assert: () => void) => Promise<boolean>>(async () => true) };
  return { service, calendar, store, crypto, sdk, current, labels, acquire, auth, list, get, batchModify, modify, createLabel, deleteLabel };
}
