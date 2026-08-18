import { getLiaClient } from './clients';
import {
  dedupeConversations,
  getPermissionRank,
  rowToConversationSummary,
  unwrapConversationRow,
} from './conversation-mappers';
import { isMissingSoftDeleteColumn, warnMissingSoftDeleteColumn } from './soft-delete';
import type { AppChatConversationRow, AppChatConversationSummary } from './types';

const CONVERSATION_COLUMNS = 'id, user_id, title, folder_id, org_id, is_pinned, created_at, updated_at';
const CONVERSATION_COLUMNS_WITH_DELETED = `${CONVERSATION_COLUMNS}, deleted_at`;

function conversationColumns(excludeDeleted: boolean): string {
  return excludeDeleted ? CONVERSATION_COLUMNS_WITH_DELETED : CONVERSATION_COLUMNS;
}

function createConversationAccessQueries(lia: any, userId: string, orgIds: string[], excludeDeleted: boolean) {
  const columns = conversationColumns(excludeDeleted);
  let own = lia.from('conversations')
    .select(columns)
    .eq('user_id', userId);
  if (excludeDeleted) own = own.is('deleted_at', null);
  own = own.order('updated_at', { ascending: false }).limit(200);
  const directConversations = lia.from('conversation_shares')
    .select(`permission, conversation:conversations(${columns})`)
    .eq('is_active', true)
    .eq('shared_with_user_id', userId);
  const directFolders = lia.from('folder_shares')
    .select('folder_id, permission')
    .eq('is_active', true)
    .eq('shared_with_user_id', userId);
  const orgConversations = orgIds.length > 0
    ? lia.from('conversation_shares')
      .select(`permission, conversation:conversations(${columns})`)
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

function isDeleted(row: AppChatConversationRow): boolean {
  return Boolean(row.deleted_at);
}

async function appendFolderConversations(
  lia: any,
  accessible: AppChatConversationSummary[],
  folderPermissionById: Map<string, 'edit' | 'view'>,
  excludeDeleted: boolean,
): Promise<void> {
  const folderIds = Array.from(folderPermissionById.keys());
  if (folderIds.length === 0) return;

  const build = (withFilter: boolean) => {
    let query = lia.from('conversations')
      .select(conversationColumns(withFilter))
      .in('folder_id', folderIds);
    if (withFilter) query = query.is('deleted_at', null);
    return query.order('updated_at', { ascending: false }).limit(200);
  };

  let { data, error } = await build(excludeDeleted);
  if (excludeDeleted && isMissingSoftDeleteColumn(error)) {
    warnMissingSoftDeleteColumn();
    ({ data, error } = await build(false));
  }
  if (error) throw new Error(error.message);

  for (const row of data || []) {
    if (isDeleted(row as AppChatConversationRow)) continue;
    const permission = folderPermissionById.get(String(row.folder_id || ''));
    if (permission) accessible.push(rowToConversationSummary(row as AppChatConversationRow, permission, true));
  }
}

export async function fetchAccessibleConversations(userId: string, orgIds: string[]): Promise<AppChatConversationSummary[]> {
  const lia = getLiaClient();
  if (!lia) throw new Error('Lia no esta configurado en este dispositivo.');

  let excludeDeleted = true;
  let results = await Promise.all(createConversationAccessQueries(lia, userId, orgIds, excludeDeleted));
  if (results.some((result) => isMissingSoftDeleteColumn(result?.error))) {
    warnMissingSoftDeleteColumn();
    excludeDeleted = false;
    results = await Promise.all(createConversationAccessQueries(lia, userId, orgIds, excludeDeleted));
  }

  const [ownResult, directShares, orgShares, directFolders, orgFolders] = results;
  const errors = [ownResult.error, directShares.error, orgShares.error, directFolders.error, orgFolders.error].filter(Boolean);
  if (errors.length > 0) throw new Error(errors[0]?.message || 'No pude cargar las conversaciones accesibles.');

  const accessible: AppChatConversationSummary[] = (ownResult.data || []).map((row: any) =>
    rowToConversationSummary(row, 'owner', false),
  );
  for (const share of [...(directShares.data || []), ...(orgShares.data || [])]) {
    const conversationRow = unwrapConversationRow(share?.conversation);
    // Un chat borrado por su dueno deja de estar disponible tambien para quien
    // lo tenia compartido: aqui la conversacion viene incrustada y el filtro de
    // la consulta no la alcanza.
    if (conversationRow && !isDeleted(conversationRow)) {
      accessible.push(rowToConversationSummary(conversationRow, share.permission === 'edit' ? 'edit' : 'view', true));
    }
  }
  await appendFolderConversations(lia, accessible, collectFolderPermissions([directFolders, orgFolders]), excludeDeleted);
  return dedupeConversations(accessible);
}
