import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestRemoteNode } from '../remote-node/node-client';
import type { RemoteNodeRecord } from '../remote-node/types';

let node: RemoteNodeRecord;
const save = vi.fn();
beforeEach(() => {
  save.mockClear();
  node = { id: 'nodo-qa', name: 'Nodo QA', baseUrl: 'https://nodo.example.invalid', token: 'token-ficticio-qa', enabled: true,
    createdAt: '2026-10-25T00:00:00Z', updatedAt: '2026-10-25T00:00:00Z', capabilities: ['open_application'] };
});
afterEach(() => vi.restoreAllMocks());
const request = () => requestRemoteNode(node, 'GET', '/health', save);

describe('Contrato de respuestas de nodos remotos', () => {
  it.each([null, [], true, 42, 'texto JSON'])('rechaza JSON no objeto sin actualizar salud ni capacidades: caso %#', async value => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(value)));
    await expect(request()).rejects.toThrow();
    expect(node.lastHealthAt).toBeUndefined(); expect(node.capabilities).toEqual(['open_application']);
    expect(save).not.toHaveBeenCalled();
  });
  it.each(['capabilities', 'health'])('metadata de capacidades inválida no reemplaza las existentes: %s', async field => {
    const capabilities = ['open_application', 42, null];
    const payload = field === 'capabilities' ? { capabilities } : { health: { capabilities } };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(payload)));
    await request(); expect(node.capabilities).toEqual(['open_application']);
  });
  it.each(['capabilities', 'health'])('conserva capacidades textuales futuras y campos adicionales: %s', async field => {
    const capabilities = ['open_application', 'capacidad-futura'];
    const payload = { success: true, extra: { version: 2 }, ...(field === 'capabilities' ? { capabilities } : { health: { capabilities } }) };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(payload)));
    expect(await request()).toEqual(payload); expect(node.capabilities).toEqual(capabilities); expect(save).toHaveBeenCalledOnce();
  });
  it('conserva el sobre legacy de texto no JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('respuesta legacy'));
    expect(await request()).toEqual({ success: true, raw: 'respuesta legacy' });
    expect(node.capabilities).toEqual(['open_application']);
  });
  it('un error remoto no textual no se guarda como metadata de texto', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: { privado: 'no textual' } }), { status: 503 }));
    await expect(request()).rejects.toThrow('503');
    expect(node.lastError).toBe('HTTP 503'); expect(save).toHaveBeenCalledOnce();
  });
  it('un rechazo de transporte no Error se normaliza sin romper el guardado', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue('rechazo no estructurado');
    await expect(request()).rejects.toBeInstanceOf(Error);
    expect(node.lastError).toBe('No se pudo contactar el nodo remoto.'); expect(save).toHaveBeenCalledOnce();
  });
});
