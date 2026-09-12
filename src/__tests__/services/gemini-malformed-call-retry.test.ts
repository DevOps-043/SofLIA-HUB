import { describe, expect, it, vi } from 'vitest';
import { runAgenticLoop } from '../../services/gemini-chat/agentic-loop';
import { isMalformedFunctionCall } from '../../services/gemini-chat/empty-response';
import { collectStreamText } from '../../services/gemini-chat/streams';

/**
 * `MALFORMED_FUNCTION_CALL` es el modelo emitiendo mal una llamada, no un
 * rechazo de la peticion: se corrige reintentando. Antes terminaba el turno y
 * el usuario tenia que reescribir su mensaje.
 */
function respuestaMalformada() {
  return { candidates: [{ finishReason: 'MALFORMED_FUNCTION_CALL', content: { parts: [] } }] };
}

function respuestaConTexto(texto: string) {
  return { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: texto }] } }] };
}

function ejecutar(sendMessage: ReturnType<typeof vi.fn>) {
  return runAgenticLoop({
    chatSession: { sendMessage },
    chatConfig: {} as never,
    messageContent: [{ text: 'abre Codex' }],
    allToolCalls: [],
    allGeneratedImages: [],
  });
}

describe('reintento ante llamada de herramienta mal formada', () => {
  it('MFC-001: reconoce el motivo de cierre', () => {
    expect(isMalformedFunctionCall(respuestaMalformada())).toBe(true);
    expect(isMalformedFunctionCall(respuestaConTexto('hola'))).toBe(false);
    expect(isMalformedFunctionCall(null)).toBe(false);
  });

  it('MFC-002: reintenta una vez y entrega la respuesta buena', async () => {
    const sendMessage = vi.fn()
      .mockResolvedValueOnce(respuestaMalformada())
      .mockResolvedValueOnce(respuestaConTexto('Abriendo Codex.'));

    const resultado = await ejecutar(sendMessage);

    expect(sendMessage).toHaveBeenCalledTimes(2);
    await expect(collectStreamText(resultado.stream)).resolves.toBe('Abriendo Codex.');
  });

  it('MFC-003: el reintento no repite el mensaje del usuario', async () => {
    const sendMessage = vi.fn()
      .mockResolvedValueOnce(respuestaMalformada())
      .mockResolvedValueOnce(respuestaConTexto('listo'));

    await ejecutar(sendMessage);

    const segundo = JSON.stringify(sendMessage.mock.calls[1]?.[0]?.message ?? '');
    expect(segundo).not.toContain('abre Codex');
    expect(segundo).toContain('mal formada');
  });

  it('MFC-004: si vuelve a fallar, pide responder SIN herramientas', async () => {
    const sendMessage = vi.fn()
      .mockResolvedValueOnce(respuestaMalformada())
      .mockResolvedValueOnce(respuestaMalformada())
      .mockResolvedValueOnce(respuestaConTexto('No pude abrirlo; reformula la peticion.'));

    const resultado = await ejecutar(sendMessage);

    // La segunda instruccion baja a texto para que el usuario reciba algo util
    // en vez de un callejon sin salida. Mismo patron que el agente de WhatsApp.
    const tercero = JSON.stringify(sendMessage.mock.calls[2]?.[0]?.message ?? '');
    expect(tercero).toContain('NO uses herramientas');
    await expect(collectStreamText(resultado.stream)).resolves.toBe('No pude abrirlo; reformula la peticion.');
  });

  it('MFC-005: no insiste indefinidamente', async () => {
    const sendMessage = vi.fn().mockResolvedValue(respuestaMalformada());

    const resultado = await ejecutar(sendMessage);

    // Envio inicial + dos reintentos, y se detiene.
    expect(sendMessage).toHaveBeenCalledTimes(3);
    await expect(collectStreamText(resultado.stream)).resolves.toContain('llamada de herramienta invalida');
  });
});
