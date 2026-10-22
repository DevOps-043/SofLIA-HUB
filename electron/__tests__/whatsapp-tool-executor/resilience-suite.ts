import { describe, expect, it, vi } from 'vitest';
import { executeWhatsAppTools, fc, makeCtx } from './fixture';
import { executeGoogleTool } from '../../whatsapp-executors/google-executors';

describe('Un handler que lanza no tumba el turno', () => {
  it('convierte la excepcion en una respuesta fallida para el modelo', async () => {
    // Antes solo el fallback capturaba: cualquier handler especializado que
    // lanzara propagaba hasta el loop y el usuario recibia un error tecnico
    // generico en vez de una respuesta del agente.
    vi.mocked(executeGoogleTool).mockRejectedValueOnce(new Error('Google no responde'));

    const result = await executeWhatsAppTools([fc('drive_list_files', {})], makeCtx(), 'jid', '5511111', false);

    expect(result.responses).toHaveLength(1);
    expect(result.responses[0].functionResponse.name).toBe('drive_list_files');
    expect(result.responses[0].functionResponse.response).toMatchObject({
      success: false,
      error: 'Google no responde',
    });
  });

  it('sigue ejecutando las demas herramientas del mismo turno', async () => {
    vi.mocked(executeGoogleTool).mockRejectedValueOnce(new Error('Google no responde'));

    const result = await executeWhatsAppTools(
      [fc('drive_list_files', {}), fc('list_processes', {})],
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
