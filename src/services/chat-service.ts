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
  loadConversations,
  loadMessages,
  migrateLegacyChatCache,
  saveMessages,
  saveMessagesToCache,
  syncPendingChatState,
  updateConversationTitle,
} from './chat';
