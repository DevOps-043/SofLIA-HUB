import type { ChatMessage } from '../../services/chat-service';

export const PLACEHOLDER_TEXT = '...';

/**
 * ¿Mostrar el indicador de "generando" para la conversación VISIBLE?
 *
 * Se basa únicamente en el placeholder de los mensajes visibles (no en un flag
 * global de carga), para que la generación sea consciente de la conversación:
 * el turno en curso vive como placeholder dentro de los mensajes de SU
 * conversación, así que al cambiar a otra conversación (sin placeholder) NO se
 * muestra carga y el usuario puede seguir chateando ahí — como en ChatGPT.
 */
export function shouldShowLoadingUi(messages: ChatMessage[]): boolean {
  const lastMessage = messages[messages.length - 1];
  return Boolean(
    lastMessage &&
    lastMessage.role === 'model' &&
    (!lastMessage.text || lastMessage.text.trim() === PLACEHOLDER_TEXT) &&
    !(lastMessage.images && lastMessage.images.length > 0)
  );
}

export function dedupeMessageList(items: ChatMessage[]) {
  const seen = new Set<string>();
  return items.filter((message) => {
    if (!message?.id || seen.has(message.id)) return false;
    seen.add(message.id);
    return true;
  });
}

export function createUserMessage(text: string, images: string[]): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: 'user',
    text,
    timestamp: Date.now(),
    images: images.length > 0 ? [...images] : undefined,
  };
}

export function createAiPlaceholder(id: string): ChatMessage {
  return {
    id,
    role: 'model',
    text: PLACEHOLDER_TEXT,
    timestamp: Date.now(),
  };
}
