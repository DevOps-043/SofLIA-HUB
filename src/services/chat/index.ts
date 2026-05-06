/**
 * API pública del paquete chat.
 *
 * Solo exporta lo que el resto del codebase necesita. Implementación queda
 * encapsulada en submódulos: types, normalize, cache, pending-state,
 * builders, recovery, remote, sync, migration, operations.
 */

export type { ChatMessage, Conversation, PendingChatState } from './types';

export {
  createConversation,
  deleteConversation,
  generateTitle,
  loadConversations,
  loadMessages,
  saveMessages,
  updateConversationTitle,
} from './operations';

export { saveMessagesToCache } from './cache';
export { migrateLegacyChatCache } from './migration';
export { syncPendingChatState } from './sync';
