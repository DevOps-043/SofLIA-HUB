import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { loadAccessibleFolderShares, type ShareAccessLevel } from './share-service';

export interface Folder {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  org_id?: string;
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

const FOLDERS_CACHE_PREFIX = 'lia_folders_';
const CONVERSATIONS_CACHE_PREFIX = 'lia_conversations_';
const PENDING_CHAT_STATE_PREFIX = 'lia_pending_chat_state_';

function getFoldersCacheKey(userId: string): string {
  return `${FOLDERS_CACHE_PREFIX}${userId}`;
}

function getAccessRank(access: ShareAccessLevel | undefined): number {
  if (access === 'owner') return 3;
  if (access === 'edit') return 2;
  return 1;
}

function normalizeFolder(raw: any): Folder {
  return {
    id: raw.id,
    user_id: raw.user_id,
    name: raw.name,
    description: raw.description ?? undefined,
    org_id: raw.org_id ?? undefined,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    is_shared: raw.is_shared ?? false,
    share_permission: raw.share_permission ?? (raw.is_shared ? 'view' : 'owner'),
    can_edit: raw.can_edit ?? (!raw.is_shared || raw.share_permission === 'edit'),
    can_share: raw.can_share ?? !raw.is_shared,
    shared_by_user_id: raw.shared_by_user_id ?? undefined,
    share_token: raw.share_token ?? null,
    shared_at: raw.shared_at ?? undefined,
  };
}

function decorateOwnedFolder(raw: any): Folder {
  return normalizeFolder({
    ...raw,
    is_shared: false,
    share_permission: 'owner',
    can_edit: true,
    can_share: true,
    shared_by_user_id: undefined,
    share_token: null,
    shared_at: undefined,
  });
}

function decorateSharedFolder(raw: any, share: { permission: 'view' | 'edit'; shared_by_user_id: string; share_token?: string | null; created_at: string }): Folder {
  return normalizeFolder({
    ...raw,
    is_shared: true,
    share_permission: share.permission,
    can_edit: share.permission === 'edit',
    can_share: false,
    shared_by_user_id: share.shared_by_user_id,
    share_token: share.share_token ?? null,
    shared_at: share.created_at,
  });
}

function pickPreferredFolder(left: Folder, right: Folder): Folder {
  const leftRank = getAccessRank(left.share_permission);
  const rightRank = getAccessRank(right.share_permission);

  if (rightRank !== leftRank) {
    return rightRank > leftRank ? right : left;
  }

  const leftUpdated = new Date(left.updated_at || left.created_at || 0).getTime();
  const rightUpdated = new Date(right.updated_at || right.created_at || 0).getTime();
  return rightUpdated >= leftUpdated ? right : left;
}

function dedupeFolders(folders: Folder[]): Folder[] {
  const byId = new Map<string, Folder>();

  for (const folder of folders) {
    if (!folder?.id) continue;
    const normalized = normalizeFolder(folder);
    const existing = byId.get(normalized.id);
    byId.set(normalized.id, existing ? pickPreferredFolder(existing, normalized) : normalized);
  }

  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime(),
  );
}

function loadFoldersFromCache(userId: string): Folder[] {
  try {
    const cached = localStorage.getItem(getFoldersCacheKey(userId));
    return cached ? dedupeFolders(JSON.parse(cached)) : [];
  } catch {
    return [];
  }
}

function saveFoldersToCache(userId: string, folders: Folder[]): void {
  try {
    localStorage.setItem(getFoldersCacheKey(userId), JSON.stringify(dedupeFolders(folders)));
  } catch {}
}

function updateFoldersCache(userId: string, updater: (folders: Folder[]) => Folder[]): Folder[] {
  const nextFolders = dedupeFolders(updater(loadFoldersFromCache(userId)));
  saveFoldersToCache(userId, nextFolders);
  return nextFolders;
}

function findFolderInCache(userId: string, folderId: string): Folder | null {
  return loadFoldersFromCache(userId).find((folder) => folder.id === folderId) || null;
}

function updateConversationFolderCache(conversationId: string, folderId: string | null): void {
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key) continue;

      if (key.startsWith(CONVERSATIONS_CACHE_PREFIX)) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const conversations = JSON.parse(raw);
        const nextConversations = conversations.map((conversation: any) =>
          conversation.id === conversationId
            ? { ...conversation, folder_id: folderId ?? undefined }
            : conversation,
        );
        localStorage.setItem(key, JSON.stringify(nextConversations));
        continue;
      }

      if (key.startsWith(PENDING_CHAT_STATE_PREFIX)) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const state = JSON.parse(raw);
        if (!state?.conversationUpserts?.[conversationId]) continue;
        state.conversationUpserts[conversationId] = {
          ...state.conversationUpserts[conversationId],
          folder_id: folderId ?? undefined,
          updated_at: new Date().toISOString(),
        };
        localStorage.setItem(key, JSON.stringify(state));
      }
    }
  } catch {}
}

export function migrateLegacyFolderCache(sourceUserId: string, targetUserId: string): void {
  if (!sourceUserId || !targetUserId || sourceUserId === targetUserId) {
    return;
  }

  const sourceFolders = loadFoldersFromCache(sourceUserId).map((folder) =>
    normalizeFolder({ ...folder, user_id: targetUserId, is_shared: false, share_permission: 'owner', can_edit: true, can_share: true }),
  );
  if (sourceFolders.length === 0) {
    return;
  }

  const targetFolders = loadFoldersFromCache(targetUserId);
  saveFoldersToCache(targetUserId, [...targetFolders, ...sourceFolders]);

  try {
    localStorage.removeItem(getFoldersCacheKey(sourceUserId));
  } catch {}
}

async function fetchAccessibleFolders(
  userId: string,
  accessUserIds: string[],
  orgId?: string,
): Promise<Folder[]> {
  const [ownedResult, sharedShares] = await Promise.all([
    supabase
      .from('folders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    loadAccessibleFolderShares(accessUserIds, orgId),
  ]);

  if (ownedResult.error) {
    console.error('[folder-service] fetch owned folders FAILED:', ownedResult.error.message, '| code:', ownedResult.error.code);
    throw ownedResult.error;
  }

  const ownedFolders = (ownedResult.data || []).map((folder: any) => decorateOwnedFolder(folder));
  const sharedFolders = sharedShares
    .filter((share) => share.folder)
    .map((share) => decorateSharedFolder(share.folder, share));

  return dedupeFolders([...ownedFolders, ...sharedFolders]);
}

export async function loadFolders(
  userId: string,
  orgId?: string,
  accessUserIds?: string[],
): Promise<Folder[]> {
  if (!userId) return [];
  if (!isSupabaseConfigured()) {
    return loadFoldersFromCache(userId);
  }

  try {
    const folders = await fetchAccessibleFolders(
      userId,
      accessUserIds && accessUserIds.length > 0 ? accessUserIds : [userId],
      orgId,
    );
    saveFoldersToCache(userId, folders);
    return folders;
  } catch {
    return loadFoldersFromCache(userId);
  }
}

export async function createFolder(
  userId: string,
  name: string,
  orgId?: string,
): Promise<Folder | null> {
  const trimmedName = name.trim();
  if (!trimmedName) {
    return null;
  }

  const now = new Date().toISOString();
  const localFolder = normalizeFolder({
    id: crypto.randomUUID(),
    user_id: userId,
    name: trimmedName,
    org_id: orgId ?? undefined,
    created_at: now,
    updated_at: now,
    is_shared: false,
    share_permission: 'owner',
    can_edit: true,
    can_share: true,
  });

  updateFoldersCache(userId, (folders) => [localFolder, ...folders]);

  if (!isSupabaseConfigured()) {
    return localFolder;
  }

  const row: Record<string, any> = { user_id: userId, name: trimmedName };
  if (orgId) row.org_id = orgId;

  const { data, error } = await supabase
    .from('folders')
    .insert(row)
    .select()
    .single();

  if (error) {
    console.error('[folder-service] createFolder FAILED:', error.message, '| code:', error.code);
    return localFolder;
  }

  const remoteFolder = decorateOwnedFolder(data);
  updateFoldersCache(userId, (folders) => [
    remoteFolder,
    ...folders.filter((folder) => folder.id !== localFolder.id && folder.id !== remoteFolder.id),
  ]);

  return remoteFolder;
}

export async function renameFolder(
  userId: string,
  folderId: string,
  name: string,
): Promise<boolean> {
  const trimmedName = name.trim();
  const folder = findFolderInCache(userId, folderId);

  if (!trimmedName || !folder?.can_share) {
    return false;
  }

  updateFoldersCache(userId, (folders) =>
    folders.map((item) =>
      item.id === folderId
        ? { ...item, name: trimmedName, updated_at: new Date().toISOString() }
        : item,
    ),
  );

  if (!isSupabaseConfigured()) {
    return true;
  }

  const { error } = await supabase
    .from('folders')
    .update({ name: trimmedName })
    .eq('id', folderId);

  if (error) {
    console.error('[folder-service] renameFolder FAILED:', error.message, '| code:', error.code);
    return false;
  }

  return true;
}

export async function deleteFolder(userId: string, folderId: string): Promise<boolean> {
  const folder = findFolderInCache(userId, folderId);

  if (!folder?.can_share) {
    return false;
  }

  updateFoldersCache(userId, (folders) => folders.filter((item) => item.id !== folderId));

  if (!isSupabaseConfigured()) {
    return true;
  }

  const { error } = await supabase
    .from('folders')
    .delete()
    .eq('id', folderId);

  if (error) {
    console.error('[folder-service] deleteFolder FAILED:', error.message, '| code:', error.code);
    return false;
  }

  return true;
}

export async function moveChatToFolder(
  userId: string,
  conversationId: string,
  folderId: string | null,
): Promise<boolean> {
  if (folderId) {
    const targetFolder = findFolderInCache(userId, folderId);
    if (!targetFolder?.can_edit) {
      return false;
    }
  }

  updateConversationFolderCache(conversationId, folderId);

  if (!isSupabaseConfigured()) {
    return true;
  }

  const { error } = await supabase
    .from('conversations')
    .update({ folder_id: folderId })
    .eq('id', conversationId);

  if (error) {
    console.error('[folder-service] moveChatToFolder FAILED:', error.message, '| code:', error.code);
    return false;
  }

  return true;
}
