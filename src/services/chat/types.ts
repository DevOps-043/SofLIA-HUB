/**
 * Tipos de dominio del chat.
 * Sin lógica — solo contratos. Permite que el resto de módulos del paquete
 * dependan de tipos sin importar implementación.
 */

import type { ShareAccessLevel } from '../share-service';

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  folder_id?: string;
  org_id?: string;
  is_pinned?: boolean;
  created_at: string;
  updated_at: string;
  is_shared?: boolean;
  share_permission?: ShareAccessLevel;
  can_edit?: boolean;
  can_share?: boolean;
  shared_by_user_id?: string;
  share_token?: string | null;
  shared_at?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  sources?: Array<{ uri: string; title: string; snippet?: string }>;
  images?: string[];
  feedback?: 'like' | 'dislike';
}

/**
 * Estado pendiente de sincronización con Supabase.
 * Persiste en localStorage para sobrevivir cierres de la app.
 */
export interface PendingChatState {
  conversationUpserts: Record<string, Conversation>;
  messageSnapshots: Record<string, ChatMessage[]>;
  deletedConversationIds: string[];
}

export const MAX_CONVERSATIONS = 500;
export const ACTIVE_MODEL_PLACEHOLDER = '...';
