import { getLiaClient } from './clients';
import {
  dedupeConversations,
  getPermissionRank,
  rowToConversationSummary,
  unwrapConversationRow,
} from './conversation-mappers';
import type { AppChatConversationRow, AppChatConversationSummary } from './types';

function createConversationAccessQueries(lia: any, userId: string, orgIds: string[]) {
  const own = lia.from('conversations')
    .select('id, user_id, title, folder_id, org_id, is_pinned, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(200);
  const directConversations = lia.from('conversation_shares')
    .select('permission, conversation:conversations(id, user_id, title, folder_id, org_id, is_pinned, created_at, updated_at)')
    .eq('is_active', true)
    .eq('shared_with_user_id', userId);
  const directFolders = lia.from('folder_shares')
    .select('folder_id, permission')
    .eq('is_active', true)
    .eq('shared_with_user_id', userId);
  const orgConversations = orgIds.length > 0
    ? lia.from('conversation_shares')
      .select('permission, conversation:conversations(id, user_id, title, folder_id, org_id, is_pinned, created_at, updated_at)')
      .eq('is_active', true)
      .is('shared_with_user_id', null)
      .in('org_id', orgIds)
    : Promise.resolve({ data: [], error: null });
  const orgFolders = orgIds.length > 0
    ? lia.from('folder_shares')
      .select('folder_id, permission')
      .eq('is_active', true)
      .is('shared_with_user_id', null)
      .in('org_id', orgIds)
    : Promise.resolve({ data: [], error: null });
  return [own, directConversations, orgConversations, directFolders, orgFolders];
}

function collectFolderPermissions(folderShareResults: any[]): Map<string, 'edit' | 'view'> {
  const folderPermissionById = new Map<string, 'edit' | 'view'>();
  for (const share of folderShareResults.flatMap((result) => result.data || [])) {
    const folderId = String(share?.folder_id || '').trim();
    if (!folderId) continue;
    const permission = share?.permission === 'edit' ? 'edit' : 'view';
    const existing = folderPermissionById.get(folderId);
    if (!existing || getPermissionRank(permission) > getPermissionRank(existing)) {
      folderPermissionById.set(folderId, permission);
    }
  }
  return folderPermissionById;
}

async function appendFolderConversations(
  lia: any,
  accessible: AppChatConversationSummary[],
  folderPermissionById: Map<string, 'edit' | 'view'>,
): Promise<void> {
  const folderIds = Array.from(folderPermissionById.keys());
  if (folderIds.length === 0) return;

  const { data, error } = await lia.from('conversations')
    .select('id, user_id, title, folder_id, org_id, is_pinned, created_at, updated_at')
    .in('folder_id', folderIds)
    .order('updated_at', { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);

  for (const row of data || []) {
    const permission = folderPermissionById.get(String(row.folder_id || ''));
    if (permission) accessible.push(rowToConversationSummary(row as AppChatConversationRow, permission, true));
  }
}

export async function fetchAccessibleConversations(userId: string, orgIds: string[]): Promise<AppChatConversationSummary[]> {
  const lia = getLiaClient();
  if (!lia) throw new Error('Lia no esta configurado en este dispositivo.');

  const [ownResult, directShares, orgShares, directFolders, orgFolders] =
    await Promise.all(createConversationAccessQueries(lia, userId, orgIds));
  const errors = [ownResult.error, directShares.error, orgShares.error, directFolders.error, orgFolders.error].filter(Boolean);
  if (errors.length > 0) throw new Error(errors[0]?.message || 'No pude cargar las conversaciones accesibles.');

  const accessible: AppChatConversationSummary[] = (ownResult.data || []).map((row: any) =>
    rowToConversationSummary(row, 'owner', false),
  );
  for (const share of [...(directShares.data || []), ...(orgShares.data || [])]) {
    const conversationRow = unwrapConversationRow(share?.conversation);
    if (conversationRow) {
      accessible.push(rowToConversationSummary(conversationRow, share.permission === 'edit' ? 'edit' : 'view', true));
    }
  }
  await appendFolderConversations(lia, accessible, collectFolderPermissions([directFolders, orgFolders]));
  return dedupeConversations(accessible);
}
