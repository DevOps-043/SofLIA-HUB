import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { google } from 'googleapis';
import { mailboxFixture } from './gmail-mailbox/fixtures';
import type { GmailClient } from '../gmail/types';

let root: string;
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-mailbox-sdk-')); });
afterEach(async () => { vi.restoreAllMocks(); await fs.rm(root, { recursive: true, force: true }); });
function setup(status: number) {
  const fx = mailboxFixture(root), oauth = new google.auth.OAuth2();
  oauth.setCredentials({ access_token: 'ficticio-sin-red' });
  const requests: Array<{ path: string; method: string; body: string }> = [];
  oauth.transporter.defaults.fetchImplementation = vi.fn<typeof fetch>(async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    if (request.signal.aborted) throw new DOMException('Cancelado', 'AbortError');
    const pathname = new URL(request.url).pathname;
    requests.push({ path: pathname, method: request.method, body: await request.text() });
    if (pathname.endsWith('/labels')) return Response.json({ labels: [{ id: 'Work_1', name: 'Trabajo', type: 'user' }, { id: 'INBOX', name: 'INBOX', type: 'system' }] });
    if (pathname.endsWith('/messages') && request.method === 'GET') return Response.json({ messages: [{ id: 'msg-0' }] });
    if (pathname.endsWith('/batchModify')) return Response.json(status === 200 ? {} : { error: { code: status, message: 'error-privado-ficticio' } }, { status });
    if (pathname.endsWith('/msg-0/trash')) return Response.json({ id: 'msg-0', labelIds: ['TRASH'] });
    throw new Error('Solicitud fuera del contrato de prueba.');
  });
  fx.acquire.mockResolvedValue({ client: google.gmail({ version: 'v1', auth: oauth }) as unknown as GmailClient });
  return { fx, oauth, requests };
}
describe('SDK Gmail real con transporte local simulado', () => {
  it('un 503 no repite la escritura ni divulga el error del proveedor', async () => {
    const { fx, requests } = setup(503);
    const result = await fx.service.batchModifyByLabel('Work_1', undefined, fx.auth);
    expect(result).toMatchObject({ success: false, processed: 0, uncertain: true });
    const effects = requests.filter(request => request.path.endsWith('/batchModify'));
    expect(effects).toHaveLength(1); expect(JSON.parse(effects[0].body)).toEqual({ ids: ['msg-0'], addLabelIds: ['INBOX'], removeLabelIds: ['Work_1'] });
    expect(JSON.stringify(result)).not.toContain('error-privado-ficticio');
  });
  it('abort durante un interceptor impide transmitir el lote', async () => {
    const { fx, oauth, requests } = setup(200);
    let release!: () => void, entered!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; }), waiting = new Promise<void>(resolve => { entered = resolve; });
    oauth.transporter.interceptors.request.add({ resolved: async options => {
      if (String(options.url).endsWith('/batchModify')) { entered(); await held; } return options;
    } });
    const cancellation = new AbortController();
    const pending = fx.service.batchModifyByLabel('Work_1', undefined, { ...fx.auth, signal: cancellation.signal });
    await waiting; cancellation.abort(); release();
    expect(await pending).toMatchObject({ success: false, uncertain: true, processed: 0 });
    expect(requests.filter(request => request.path.endsWith('/batchModify'))).toHaveLength(0);
  });
  it('papelera conserva el método y ruta del SDK y exige aprobación previa', async () => {
    const { fx, requests } = setup(200);
    expect(await fx.service.trashMessage('msg-0', fx.auth)).toMatchObject({ success: true, effectsConfirmed: 1 });
    expect(fx.auth.approve).toHaveBeenCalledOnce();
    expect(requests).toMatchObject([{ path: '/gmail/v1/users/me/messages/msg-0/trash', method: 'POST' }]);
  });
});
