import { supabase } from '../../lib/supabase';
import { normalizeConversationShare, normalizeFolderShare } from './normalizers';
import type { ConversationShare, FolderShare } from './types';

export async function upsertConversationShareRow(payload: Record<string, any>): Promise<ConversationShare> {
  const { data, error } = await supabase
    .from('conversation_shares')
    .upsert(payload, { onConflict: 'id' })
    .select('*')
    .single();

  if (error) {
    console.error('[share-service] upsertConversationShareRow FAILED:', error.message, '| code:', error.code);
    throw new Error(error.message || 'No se pudo guardar la comparticion de la conversacion.');
  }

  return normalizeConversationShare(data);
}

export async function upsertFolderShareRow(payload: Record<string, any>): Promise<FolderShare> {
  const { data, error } = await supabase
    .from('folder_shares')
    .upsert(payload, { onConflict: 'id' })
    .select('*')
    .single();

  if (error) {
    console.error('[share-service] upsertFolderShareRow FAILED:', error.message, '| code:', error.code);
    throw new Error(error.message || 'No se pudo guardar la comparticion de la carpeta.');
  }

  return normalizeFolderShare(data);
}
