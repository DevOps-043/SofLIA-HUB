/**
 * Tests PERSIST-1..5: la generación sobrevive al cambio de conversación y nunca
 * deja el chat bloqueado con un "..." pegado.
 *
 * Cubren las funciones puras que sostienen el fix:
 *  - shouldShowLoadingUi: la carga es por-vista (placeholder de los mensajes
 *    visibles), no un flag global → poder chatear en otra conversación mientras
 *    una sigue generando.
 *  - withoutActivePlaceholders: al cachear/cargar se quita el placeholder de un
 *    turno en curso para que un turno interrumpido no bloquee el input.
 */
import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../../services/chat-service';
import { PLACEHOLDER_TEXT, shouldShowLoadingUi } from '../../hooks/chat-processor/message-utils';
import { hasActivePlaceholder, withoutActivePlaceholders } from '../../hooks/chat-manager/helpers';

function msg(partial: Partial<ChatMessage> & { role: ChatMessage['role'] }): ChatMessage {
  return { id: crypto.randomUUID(), text: '', timestamp: Date.now(), ...partial };
}

describe('chat generation persistence', () => {
  it('PERSIST-1: muestra carga cuando el último mensaje visible es un placeholder', () => {
    const messages = [msg({ role: 'user', text: 'hola' }), msg({ role: 'model', text: PLACEHOLDER_TEXT })];
    expect(shouldShowLoadingUi(messages)).toBe(true);
  });

  it('PERSIST-2: NO muestra carga en una conversación sin placeholder (poder chatear en otra)', () => {
    const messages = [msg({ role: 'user', text: 'hola' }), msg({ role: 'model', text: 'respuesta lista' })];
    expect(shouldShowLoadingUi(messages)).toBe(false);
  });

  it('PERSIST-3: una imagen generada no cuenta como placeholder de carga', () => {
    const messages = [msg({ role: 'model', text: '', images: ['data:image/png;base64,AAAA'] })];
    expect(shouldShowLoadingUi(messages)).toBe(false);
  });

  it('PERSIST-4: withoutActivePlaceholders quita el "..." en curso y conserva lo real', () => {
    const messages = [
      msg({ role: 'user', text: 'pregunta' }),
      msg({ role: 'model', text: 'respuesta previa' }),
      msg({ role: 'user', text: 'otra pregunta' }),
      msg({ role: 'model', text: PLACEHOLDER_TEXT }),
    ];
    const cleaned = withoutActivePlaceholders(messages);
    expect(cleaned).toHaveLength(3);
    expect(hasActivePlaceholder(cleaned)).toBe(false);
    expect(cleaned[cleaned.length - 1]?.text).toBe('otra pregunta');
  });

  it('PERSIST-5: withoutActivePlaceholders no toca mensajes ya completados', () => {
    const messages = [
      msg({ role: 'user', text: 'hola' }),
      msg({ role: 'model', text: 'todo bien' }),
    ];
    expect(withoutActivePlaceholders(messages)).toEqual(messages);
  });
});
