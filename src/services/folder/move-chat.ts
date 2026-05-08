import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { findFolderInCache } from './cache';
import { updateConversationFolderCache } from './conversation-cache';

export async function moveChatToFolder(
  userId: string,
  conversationId: string,
  folderId: string | null,
): Promise<boolean> {
  if (folderId) {
    const targetFolder = findFolderInCache(userId, folderId);
    if (!targetFolder?.can_edit) return false;
  }

  updateConversationFolderCache(conversationId, folderId);

  if (!isSupabaseConfigured()) return true;

  const { error } = await supabase.from('conversations').update({ folder_id: folderId }).eq('id', conversationId);
  if (error) {
    console.error('[folder-service] moveChatToFolder FAILED:', error.message, '| code:', error.code);
    return false;
  }

  return true;
}
