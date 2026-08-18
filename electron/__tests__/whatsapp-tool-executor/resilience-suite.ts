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
      error: 'IRIS no responde',
    });
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
});
