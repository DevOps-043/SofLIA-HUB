import { vi } from 'vitest';
import { fixture } from '../gmail-plans/fixtures';
import { SYSTEM_LABEL_IDS } from '../../gmail/constants';
import type { GmailClient } from '../../gmail/types';

export function mailboxFixture(root: string, count = 2) {
  const fx = fixture(root, { count });
  fx.labels.set('Work_1', { id: 'Work_1', name: 'Trabajo' });
  fx.labels.set('Other_1', { id: 'Other_1', name: 'Otra' });
  for (const [id] of fx.current) fx.current.set(id, ['INBOX', 'Work_1']);
  const labelsList = vi.fn(async () => ({ data: { labels: [...fx.labels.values()].map(label => ({ ...label,
    type: SYSTEM_LABEL_IDS.has(label.id) ? 'system' : 'user' })) } }));
  const list = vi.fn(async (args: { labelIds?: string[]; maxResults?: number; pageToken?: string }) => {
    const selected = [...fx.current].filter(([, labels]) => !args.labelIds?.length || args.labelIds.every(id => labels.includes(id))).map(([id]) => ({ id }));
    const offset = Number(args.pageToken ?? 0), size = args.maxResults ?? 100;
    return { data: { messages: selected.slice(offset, offset + size), nextPageToken: offset + size < selected.length ? String(offset + size) : undefined } };
  });
  const trash = vi.fn(async ({ id }: { id: string }) => { fx.current.set(id, ['TRASH']); return { data: { id } }; });
  const client = { users: { messages: { ...fx.sdk.users.messages, list, trash }, labels: { ...fx.sdk.users.labels, list: labelsList } } } as unknown as GmailClient;
  fx.acquire.mockResolvedValue({ client });
  return { ...fx, list, labelsList, trash, client };
}
