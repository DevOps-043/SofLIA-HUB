import { describe, expect, it, vi } from 'vitest';
import { executeWhatsAppTools, fc, makeCtx } from './fixture';
import { executeIrisTool } from '../../whatsapp-executors/iris-executors';

describe('Un handler que lanza no tumba el turno', () => {
  it('convierte la excepcion en una respuesta fallida para el modelo', async () => {
    // Antes solo el fallback capturaba: cualquier handler especializado que
    // lanzara propagaba hasta el loop y el usuario recibia un error tecnico
    // generico en vez de una respuesta del agente.
    vi.mocked(executeIrisTool).mockRejectedValueOnce(new Error('IRIS no responde'));

    const result = await executeWhatsAppTools([fc('iris_get_teams', {})], makeCtx(), 'jid', '5511111', false);

    expect(result.responses).toHaveLength(1);
    expect(result.responses[0].functionResponse.name).toBe('iris_get_teams');
    expect(result.responses[0].functionResponse.response).toMatchObject({
      success: false,
      errorCode: 'TOOL_EXECUTION_FAILED',
      correlationId: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
    expect(JSON.stringify(result)).not.toContain('IRIS no responde');
  });

  it('sigue ejecutando las demas herramientas del mismo turno', async () => {
    vi.mocked(executeIrisTool).mockRejectedValueOnce(new Error('IRIS no responde'));

    const result = await executeWhatsAppTools(
      [fc('iris_get_teams', {}), fc('list_processes', {})],
      makeCtx(),
      'jid',
      '5511111',
      false,
    );

    expect(result.responses).toHaveLength(2);
    expect(result.responses[0].functionResponse.response).toMatchObject({ success: false });
    expect(result.responses[1].functionResponse.response).toMatchObject({ success: true });
  });
  it('una guarda que lanza impide ejecutar y no filtra su excepción', async () => {
    const { executeToolDirect } = await import('../../computer-use-handlers');
    vi.mocked(executeToolDirect).mockClear();
    const result = await executeWhatsAppTools([fc('delete_item', { path: 'C:/tmp/ficticio.txt' })],
      makeCtx({ requestConfirmation: vi.fn(async () => { throw new Error('token-privado-ficticio'); }) }), 'jid', '5511111', false);
    expect(result.responses[0].functionResponse.response).toMatchObject({ success: false, errorCode: 'TOOL_GUARD_FAILED', correlationId: expect.any(String) });
    expect(JSON.stringify(result)).not.toContain('token-privado-ficticio');
    expect(executeToolDirect).not.toHaveBeenCalled();
  });
  it('el fallback sanea su excepción y conserva el siguiente resultado', async () => {
    const { executeToolDirect } = await import('../../computer-use-handlers');
    const { dynamicToolService } = await import('../../dynamic-tool-service');
    vi.mocked(dynamicToolService.hasTool).mockResolvedValueOnce(false);
    vi.mocked(executeToolDirect).mockRejectedValueOnce(new Error('ruta-secreta-ficticia'));
    const result = await executeWhatsAppTools([fc('herramienta_fallback_ficticia', { path: 'C:/tmp' }), fc('list_processes')], makeCtx(), 'jid', '5511111', false);
    expect(result.responses).toHaveLength(2);
    expect(result.responses[0].functionResponse.response).toMatchObject({ success: false, errorCode: 'TOOL_EXECUTION_FAILED' });
    expect(result.responses[1].functionResponse.response).toMatchObject({ success: true });
    expect(JSON.stringify(result)).not.toContain('ruta-secreta-ficticia');
  });
  it('una excepción sin tipo Error mantiene un mensaje público fijo', async () => {
    vi.mocked(executeIrisTool).mockRejectedValueOnce({ token: 'dato-privado-ficticio', cause: 'causa-privada' });
    const result = await executeWhatsAppTools([fc('iris_get_teams')], makeCtx(), 'jid', '5511111', false);
    expect(result.responses[0].functionResponse.response).toMatchObject({ success: false, errorCode: 'TOOL_EXECUTION_FAILED' });
    expect(JSON.stringify(result)).not.toMatch(/dato-privado|causa-privada/);
  });
});
