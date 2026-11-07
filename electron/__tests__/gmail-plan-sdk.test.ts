import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { google } from 'googleapis';
import { fixture, owner, guard, plan } from './gmail-plans/fixtures';
import type { GmailClient } from '../gmail/types';

let root: string;
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-plan-sdk-')); });
afterEach(async () => { vi.restoreAllMocks(); await fs.rm(root, { recursive: true, force: true }); });

function setup(root: string, batchStatus: number) {
  const fx = fixture(root, { count: 1 });
  const oauth = new google.auth.OAuth2(); oauth.setCredentials({ access_token: 'token-ficticio-sin-red' });
  const requests: Array<{ pathname: string; method: string; signal: AbortSignal | null; body: string }> = [];
  const transport = vi.fn<typeof fetch>(async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    if (request.signal.aborted) throw new DOMException('Cancelado', 'AbortError');
    const pathname = new URL(request.url).pathname;
    requests.push({ pathname, method: request.method, signal: request.signal, body: await request.text() });
    if (pathname.endsWith('/labels') && request.method === 'GET') return Response.json({ labels: [] });
    if (pathname.endsWith('/labels')) return Response.json({ id: 'Label_1', name: 'Empresa' });
    if (pathname.endsWith('/messages/msg-0')) return Response.json({ id: 'msg-0', labelIds: ['INBOX'] });
    if (pathname.endsWith('/messages/batchModify')) return Response.json(batchStatus === 200 ? {} : { error: { code: batchStatus, message: 'fallo-ficticio-privado' } }, { status: batchStatus });
    if (pathname.endsWith('/messages/send')) return Response.json({ id: 'correo-ficticio' });
    throw new Error('Ruta no prevista en el transporte de prueba');
  });
  oauth.transporter.defaults.fetchImplementation = transport;
  const sdk = google.gmail({ version: 'v1', auth: oauth });
  fx.acquire.mockResolvedValue({ client: sdk as unknown as GmailClient });
  return { fx, oauth, sdk, transport, requests };
}

describe('Planes con SDK Google real y fetch simulado', () => {
  it('entrega el lote correcto una vez y deshabilita reintentos tras 503', async () => {
    const { fx, requests } = setup(root, 503); const value = plan(1); await fx.store.account(owner).save(value, guard);
    const result = await fx.service.applyOrganizationPlan(value.id, undefined, fx.auth);
    expect(result).toMatchObject({ success: false, partial: true, uncertain: true });
    const writes = requests.filter(request => request.pathname.endsWith('/messages/batchModify'));
    expect(writes).toHaveLength(1);
    expect(JSON.parse(writes[0].body)).toEqual({ ids: ['msg-0'], addLabelIds: ['Label_1'], removeLabelIds: ['INBOX'] });
    expect(writes[0].signal).toBeInstanceOf(AbortSignal);
    expect(JSON.stringify(result)).not.toContain('fallo-ficticio-privado');
  });

  it('el SDK no transmite el efecto si se aborta mientras su interceptor espera', async () => {
    const { fx, oauth, requests } = setup(root, 200); const value = plan(1); await fx.store.account(owner).save(value, guard);
    let release!: () => void, entered!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    const waiting = new Promise<void>(resolve => { entered = resolve; });
    oauth.transporter.interceptors.request.add({ resolved: async options => {
      if (String(options.url).endsWith('/messages/batchModify')) { entered(); await held; }
      return options;
    } });
    const cancellation = new AbortController();
    const pending = fx.service.applyOrganizationPlan(value.id, undefined, { ...fx.auth, signal: cancellation.signal });
    await waiting; cancellation.abort(); release();
    expect(await pending).toMatchObject({ success: false, uncertain: true });
    expect(requests.filter(request => request.pathname.endsWith('/messages/batchModify'))).toHaveLength(0);
    expect((await fx.store.account(owner).load(value.id, guard)).pending?.kind).toBe('modify');
  });

  it('el envío Gmail también propaga cancelación al SDK durante una espera anterior al transporte', async () => {
    const { fx, oauth, requests } = setup(root, 200);
    let release!: () => void, entered!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; }); const waiting = new Promise<void>(resolve => { entered = resolve; });
    oauth.transporter.interceptors.request.add({ resolved: async options => {
      if (String(options.url).endsWith('/messages/send')) { entered(); await held; }
      return options;
    } });
    const cancellation = new AbortController();
    const pending = fx.service.sendEmail({ to: ['dest@example.test'], subject: 'Prueba', body: 'Ficticio' }, { ...fx.auth, signal: cancellation.signal });
    await waiting; cancellation.abort(); release();
    expect(await pending).toMatchObject({ success: false, uncertain: true });
    expect(requests.filter(request => request.pathname.endsWith('/messages/send'))).toHaveLength(0);
  });
});
