/**
 * Capa de acceso a Supabase para conversaciones y mensajes.
 *
 * Único módulo que conoce el schema remoto. El resto del paquete trabaja con
 * tipos de dominio (Conversation, ChatMessage). Si en el futuro se agrega un
 * backend alternativo (REST, GraphQL), solo este archivo cambia.
 */

import { supabase } from '../../lib/supabase';
import {
  loadAccessibleConversationShares,
  loadAccessibleFolderShares,
  loadOutgoingConversationShares,
} from '../share-service';
import {
  decorateOwnedConversation,
  decorateSharedConversation,
  dedupeConversations,
  dedupeMessages,
  normalizeConversation,
} from './normalize';
import { MAX_CONVERSATIONS, type ChatMessage, type Conversation } from './types';

export async function fetchAccessibleConversations(
  userId: string,
  accessUserIds: string[],
  orgId?: string,
): Promise<Conversation[]> {
  const [
    ownConversationsResult,
    ownedFoldersResult,
    sharedConversationShares,
    sharedFolderShares,
    outgoingConversationShares,
  ] = await Promise.all([
    supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(MAX_CONVERSATIONS),
    supabase.from('folders').select('id').eq('user_id', userId),
    loadAccessibleConversationShares(accessUserIds, orgId),
    loadAccessibleFolderShares(accessUserIds, orgId),
    loadOutgoingConversationShares(userId, orgId),
  ]);

  if (ownConversationsResult.error) {
    console.error(
      '[chat-service] fetch own conversations FAILED:',
      ownConversationsResult.error.message,
      '| code:',
      ownConversationsResult.error.code,
    );
    throw ownConversationsResult.error;
  }

  if (ownedFoldersResult.error) {
    console.error(
      '[chat-service] fetch owned folder ids FAILED:',
      ownedFoldersResult.error.message,
      '| code:',
      ownedFoldersResult.error.code,
    );
    throw ownedFoldersResult.error;
  }

  const outgoingShareMap = new Map<string, { share_token?: string | null; created_at: string }>();
  for (const share of outgoingConversationShares) {
    const existing = outgoingShareMap.get(share.conversation_id);
    if (!existing || (share.share_token && !existing.share_token)) {
      outgoingShareMap.set(share.conversation_id, {
        share_token: share.share_token ?? null,
        created_at: share.created_at,
      });
    }
  }

  const ownedConversations = (ownConversationsResult.data || []).map((conversation: Record<string, unknown>) =>
    decorateOwnedConversation(conversation, outgoingShareMap.get(conversation.id as string)),
  );

  const ownedFolderIds = new Set(
    (ownedFoldersResult.data || []).map((folder: { id: string }) => folder.id),
  );
  const accessibleFolderIds = Array.from(
    new Set([
      ...ownedFolderIds,
      ...sharedFolderShares.map((share) => share.folder_id),
    ]),
  );

  let folderConversations: Conversation[] = [];
  if (accessibleFolderIds.length > 0) {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .in('folder_id', accessibleFolderIds)
      .order('updated_at', { ascending: false })
      .limit(MAX_CONVERSATIONS);

    if (error) {
      console.error(
        '[chat-service] fetch folder conversations FAILED:',
        error.message,
        '| code:',
        error.code,
      );
      throw error;
    }

    const sharedFolderShareMap = new Map(sharedFolderShares.map((share) => [share.folder_id, share]));

    folderConversations = (data || []).map((raw: Record<string, unknown>) => {
      if (raw.user_id === userId) {
        return decorateOwnedConversation(raw, outgoingShareMap.get(raw.id as string));
      }

      const folderShare = sharedFolderShareMap.get(raw.folder_id as string);
      if (folderShare) {
        return decorateSharedConversation(raw, folderShare);
      }

      if (ownedFolderIds.has(raw.folder_id as string)) {
        return normalizeConversation({
          ...raw,
          is_shared: true,
          share_permission: 'edit',
          can_edit: true,
          can_share: false,
          shared_by_user_id: raw.user_id as string,
          share_token: null,
          shared_at: raw.created_at as string,
        });
      }

      return decorateOwnedConversation(raw);
    });
  }

  const directSharedConversations = sharedConversationShares
    .filter((share) => share.conversation)
    .map((share) =>
      share.conversation?.user_id === userId
        ? decorateOwnedConversation(
            share.conversation as unknown as Record<string, unknown>,
            outgoingShareMap.get(share.conversation.id),
          )
        : decorateSharedConversation(share.conversation as unknown as Record<string, unknown>, share),
    );

  return dedupeConversations([
    ...ownedConversations,
    ...folderConversations,
    ...directSharedConversations,
  ]);
}

export async function upsertConversationRemote(
  conversation: Conversation,
): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from('conversations')
    .upsert(
      {
        id: conversation.id,
        user_id: conversation.user_id,
        title: conversation.title,
        folder_id: conversation.folder_id || null,
        org_id: conversation.org_id || null,
        is_pinned: conversation.is_pinned || false,
        created_at: conversation.created_at,
        updated_at: conversation.updated_at,
      },
      { onConflict: 'id' },
    )
    .select()
    .single();

  if (error) {
    console.error(
      '[chat-service] upsertConversationRemote FAILED:',
      error.message,
      '| code:',
      error.code,
    );
    return null;
  }

  return normalizeConversation(data);
}

export async function syncMessagesRemote(
  conversationId: string,
  userId: string,
  messages: ChatMessage[],
): Promise<boolean> {
  const validMessages = dedupeMessages(messages);

  if (validMessages.length === 0) {
    return true;
  }

  const rows = validMessages.map((message) => ({
    id: message.id,
    conversation_id: conversationId,
    user_id: userId,
    role: message.role,
    content: message.text,
    created_at: new Date(message.timestamp).toISOString(),
    metadata: {
      sources: message.sources || null,
      images: message.images || null,
      feedback: message.feedback || null,
    },
  }));

  const { error } = await supabase.from('messages').upsert(rows, { onConflict: 'id' });

  if (error) {
    console.error(
      '[chat-service] syncMessagesRemote upsert FAILED:',
      error.message,
      '| code:',
      error.code,
    );
    return false;
  }

  return true;
}

export async function deleteConversationRemote(conversationId: string): Promise<boolean> {
  const deleteRelatedRows = async (table: string, column: string): Promise<boolean> => {
    const { error } = await supabase.from(table).delete().eq(column, conversationId);

    if (!error) return true;

    // Tabla inexistente: aceptable, seguimos. Cualquier otro error sí bloquea.
    if (error.code === '42P01') {
      console.warn(
        `[chat-service] ${table} table is missing while deleting conversation ${conversationId}; continuing.`,
      );
      return true;
    }

    console.error(
      `[chat-service] deleteConversationRemote ${table} FAILED:`,
      error.message,
      '| code:',
      error.code,
    );
    return false;
  };

  const dependenciesDeleted = await Promise.all([
    deleteRelatedRows('conversation_shares', 'conversation_id'),
    deleteRelatedRows('workspace_sources', 'conversation_id'),
  ]);

  if (dependenciesDeleted.some((ok) => !ok)) {
    return false;
  }

  const { error: messageError } = await supabase
    .from('messages')
    .delete()
    .eq('conversation_id', conversationId);

  if (messageError) {
    console.error(
      '[chat-service] deleteConversationRemote messages FAILED:',
      messageError.message,
      '| code:',
      messageError.code,
    );
    return false;
  }

  const { error: conversationError } = await supabase
    .from('conversations')
    .delete()
    .eq('id', conversationId);

  if (conversationError) {
    console.error(
      '[chat-service] deleteConversationRemote conversation FAILED:',
      conversationError.message,
      '| code:',
      conversationError.code,
    );
    return false;
  }

  return true;
}
