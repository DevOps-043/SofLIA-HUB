import { describe, expect, it, vi } from 'vitest';
import { requestLearningWorkspace } from '../learning-workspace-access';
import { readLearningResponse } from '../learning-live-http';
const ref = { organization_slug: 'acme', session_id: '00000000-0000-4000-8000-000000000031', operation: { type: 'snapshot' } };
function deps() {
  return { baseUrl: 'https://learning.test', getIdentity: vi.fn<() => Promise<{userId:string;accessToken:string}|null>>(async () => ({ userId: '00000000-0000-4000-8000-000000000013', accessToken: 'private-token' })), fetcher: vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ private_answer: 'Respuesta privada' }))) };
}
describe('frontera main del aula colaborativa', () => {
  it('construye el endpoint fijo y conserva el bearer fuera del resultado', async () => {
    const d = deps(); const result = await requestLearningWorkspace(ref,d);
    expect(result).toEqual({success:true,private_answer:'Respuesta privada'});
    expect(d.fetcher.mock.calls[0][0]).toBe('https://learning.test/api/auth/live/workspace');
    expect(d.fetcher.mock.calls[0][1]?.redirect).toBe('error');
    expect(JSON.stringify(result)).not.toContain('private-token');
  });
  it('rechaza campos ajenos, actor y destinos proporcionados por renderer', async () => {
    const d = deps();
    for (const extra of [{user_id:'teacher'},{url:'https://evil.test'},{role:'admin'}]) expect((await requestLearningWorkspace({...ref,...extra},d)).success).toBe(false);
    expect(d.fetcher).not.toHaveBeenCalled();
  });
  it('no hace red sin identidad y descarta respuesta después de logout', async () => {
    const d = deps(); d.getIdentity.mockResolvedValueOnce(null);
    expect((await requestLearningWorkspace(ref,d)).success).toBe(false); expect(d.fetcher).not.toHaveBeenCalled();
    d.getIdentity.mockResolvedValueOnce({userId:'a',accessToken:'token'}).mockResolvedValueOnce(null);
    expect((await requestLearningWorkspace(ref,d)).success).toBe(false);
  });
  it('acota bytes reales del stream antes de parsear', async () => {
    const response = new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array(100));controller.close();}}));
    await expect(readLearningResponse(response,10)).rejects.toThrow('fuera de límites');
  });
  it('no filtra fallos internos ni acepta salidas malformadas', async () => {
    const d = deps(); d.fetcher.mockRejectedValueOnce(new Error('token secreto'));
    const result = await requestLearningWorkspace(ref,d); expect(JSON.stringify(result)).not.toContain('secreto');
    d.fetcher.mockResolvedValueOnce(new Response(JSON.stringify({snapshot:{user_id:'otro'}})));
    expect((await requestLearningWorkspace(ref,d)).success).toBe(false);
  });
});
