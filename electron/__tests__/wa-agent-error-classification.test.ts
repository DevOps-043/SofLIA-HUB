import { describe, expect, it } from 'vitest';
import {
  classifyWhatsAppAgentError,
  getWhatsAppAgentUserErrorMessage,
  isModelAvailabilityError,
} from '../wa-agent/agent-errors';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent';

/** Formato real de un error del SDK legado: el endpoint viaja SIEMPRE. */
function sdkError(status: string, body: string): Error {
  return new Error(`[GoogleGenerativeAI Error]: Error fetching from ${ENDPOINT}: [${status}] ${body}`);
}

describe('classifyWhatsAppAgentError: la URL del endpoint no debe clasificar', () => {
  it('no culpa al modelo cuando el cuerpo habla de una herramienta inexistente', () => {
    // La URL contiene "models/gemini-3.6-flash", asi que antes cualquier
    // "not found" en el cuerpo se atribuia al modelo.
    const error = sdkError('400 Bad Request', 'Function orb_mode is not found in the tool declarations.');

    expect(isModelAvailabilityError(error)).toBe(false);
    expect(classifyWhatsAppAgentError(error)).toBe('unknown');
    expect(getWhatsAppAgentUserErrorMessage(error)).not.toContain('no esta disponible para esta key');
  });

  it('no culpa al modelo por un "not supported" de una funcion', () => {
    const error = sdkError('400 Bad Request', 'Tool use with this configuration is not supported.');

    expect(isModelAvailabilityError(error)).toBe(false);
    expect(classifyWhatsAppAgentError(error)).toBe('unknown');
  });

  it('no culpa al modelo por un rol invalido, aunque "MODEL" salga en los roles validos', () => {
    // Caso real: la lista de roles validos contiene la palabra MODEL, y el
    // mensaje contiene "not supported". El modelo estaba respondiendo bien.
    const error = sdkError(
      '400 Bad Request',
      "Role 'function' is not supported. Please use a valid role: SYSTEM, SYSTEM_1, USER, ASSISTANT, DEVELOPER, CONTEXT, USER_CONTEXT, MODEL, USER.",
    );

    expect(isModelAvailabilityError(error)).toBe(false);
    expect(classifyWhatsAppAgentError(error)).toBe('unknown');
    expect(getWhatsAppAgentUserErrorMessage(error)).not.toContain('no esta disponible para esta key');
    expect(getWhatsAppAgentUserErrorMessage(error)).toContain("Role 'function' is not supported");
  });

  it('sigue detectando un modelo realmente ausente', () => {
    const error = sdkError(
      '404 Not Found',
      'models/gemini-3.6-flash is not found for API version v1beta, or is not supported for generateContent.',
    );

    expect(isModelAvailabilityError(error)).toBe(true);
    expect(classifyWhatsAppAgentError(error)).toBe('model-unavailable');
  });

  it('sigue detectando cuota y key invalida', () => {
    expect(classifyWhatsAppAgentError(sdkError('429 Too Many Requests', 'Resource exhausted.'))).toBe('quota');
    expect(classifyWhatsAppAgentError(sdkError('400 Bad Request', 'API key not valid.'))).toBe('invalid-api-key');
  });

  it('el bucket unknown adjunta el detalle tecnico sin cortar la causa', () => {
    const error = sdkError(
      '400 Bad Request',
      'Please enable tool_config.include_server_side_tool_invocations to use Built-in tools with Function calling',
    );

    const message = getWhatsAppAgentUserErrorMessage(error);
    expect(message).toContain('Detalle:');
    expect(message).toContain('include_server_side_tool_invocations');
    expect(message).toContain('Function calling');
  });

  it('el detalle tecnico redacta secretos', () => {
    const error = new Error(`Error fetching from ${ENDPOINT}?key=AIzaSyDUMMYKEYVALUE1234567890: [400] boom`);

    const message = getWhatsAppAgentUserErrorMessage(error);
    expect(message).not.toContain('AIzaSyDUMMYKEYVALUE1234567890');
  });
});
