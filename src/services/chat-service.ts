/**
 * Barrel re-export del paquete `./chat`.
 *
 * Este archivo existe para preservar los imports históricos
 * (`from '../services/chat-service'`). La implementación real vive en
 * submódulos cohesivos dentro de `./chat/`. Cualquier código nuevo debería
 * importar directamente de `./chat` en lugar de este archivo.
 */

export type { ChatMessage, Conversation, PendingChatState } from './chat';
export {
  createConversation,
  deleteConversation,
  generateTitle,
  generateTitleWithModel,
  loadConversations,
  loadMessages,
  migrateLegacyChatCache,
  PENDING_MODEL_TITLE,
  saveMessages,
  saveMessagesToCache,
  syncPendingChatState,
  toggleConversationPin,
  updateConversationTitle,
} from './chat';
