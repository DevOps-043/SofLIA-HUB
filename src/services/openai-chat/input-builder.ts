import type { ResponseInput } from 'openai/resources/responses/responses';
import type { ConversationMessage } from '../gemini-chat/types';

/**
 * Historial en el formato de la Responses API. A diferencia de Gemini, OpenAI
 * no exige alternancia estricta de roles ni que el primer turno sea del
 * usuario, asi que basta con mapear y recortar.
 */
export function buildOpenAIHistory(history: ConversationMessage[]): ResponseInput {
  return history
    .slice(-50)
    .filter((message) => message.text && message.text.trim().length > 0)
    .map((message) => ({
      role: message.role === 'model' ? ('assistant' as const) : ('user' as const),
      content: message.text,
    }));
}

/**
 * Turno del usuario. Las imagenes llegan como data URLs desde el chat y la
 * Responses API las acepta tal cual en `image_url`.
 */
export function buildUserMessage(text: string, images?: string[]): ResponseInput[number] {
  const imageUrls = (images || []).filter((image) => /^data:[^;]+;base64,/.test(image));
  if (imageUrls.length === 0) return { role: 'user', content: text };

  return {
    role: 'user',
    content: [
      { type: 'input_text', text },
      ...imageUrls.map((imageUrl) => ({ type: 'input_image' as const, image_url: imageUrl, detail: 'auto' as const })),
    ],
  };
}
