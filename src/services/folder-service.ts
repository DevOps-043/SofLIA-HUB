import { isSupabaseConfigured, supabase } from '../lib/supabase';

export interface Folder {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  org_id?: string;
  created_at: string;
  updated_at: string;
}

const FOLDERS_CACHE_PREFIX = 'lia_folders_';
const CONVERSATIONS_CACHE_PREFIX = 'lia_conversations_';
const PENDING_CHAT_STATE_PREFIX = 'lia_pending_chat_state_';

function getFoldersCacheKey(userId: string): string {
  return `${FOLDERS_CACHE_PREFIX}${userId}`;
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
  };
}

function dedupeFolders(folders: Folder[]): Folder[] {
  const byId = new Map<string, Folder>();

  for (const folder of folders) {
    if (!folder?.id) continue;
    const normalized = normalizeFolder(folder);
    const existing = byId.get(normalized.id);
    if (!existing) {
      byId.set(normalized.id, normalized);
      continue;
    }

    const existingUpdated = new Date(existing.updated_at || existing.created_at || 0).getTime();
    const nextUpdated = new Date(normalized.updated_at || normalized.created_at || 0).getTime();
    if (nextUpdated >= existingUpdated) {
      byId.set(normalized.id, normalized);
    }
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

function findFolderUserId(folderId: string): string | null {
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith(FOLDERS_CACHE_PREFIX)) continue;

      const userId = key.slice(FOLDERS_CACHE_PREFIX.length);
      const folders = loadFoldersFromCache(userId);
      if (folders.some((folder) => folder.id === folderId)) {
        return userId;
      }
    }
  } catch {}

  return null;
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

export async function loadFolders(userId: string): Promise<Folder[]> {
  if (!userId) return [];
  if (!isSupabaseConfigured()) {
    return loadFoldersFromCache(userId);
  }

  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error loading folders:', error);
    return loadFoldersFromCache(userId);
  }
  const folders = dedupeFolders((data || []).map((folder) => normalizeFolder(folder)));
  saveFoldersToCache(userId, folders);
  return folders;
}

export async function createFolder(
  userId: string,
  name: string,
  orgId?: string
): Promise<Folder | null> {
  const now = new Date().toISOString();
  const localFolder: Folder = {
    id: crypto.randomUUID(),
    user_id: userId,
    name: name.trim(),
    org_id: orgId ?? undefined,
    created_at: now,
    updated_at: now,
  };

  updateFoldersCache(userId, (folders) => [localFolder, ...folders]);

  if (!isSupabaseConfigured()) {
    return localFolder;
  }

  const row: Record<string, any> = { user_id: userId, name: name.trim() };
  if (orgId) row.org_id = orgId;

  const { data, error } = await supabase
    .from('folders')
    .insert(row)
    .select()
    .single();

  if (error) {
    console.error('Error creating folder:', error);
    return localFolder;
  }
  const remoteFolder = normalizeFolder(data);
  updateFoldersCache(userId, (folders) => [
    remoteFolder,
    ...folders.filter((folder) => folder.id !== localFolder.id && folder.id !== remoteFolder.id),
  ]);
  return remoteFolder;
}

export async function renameFolder(
  folderId: string,
  name: string
): Promise<boolean> {
  const userId = findFolderUserId(folderId);
  if (userId) {
    updateFoldersCache(userId, (folders) =>
      folders.map((folder) =>
        folder.id === folderId
          ? { ...folder, name: name.trim(), updated_at: new Date().toISOString() }
          : folder,
      ),
    );
  }

  if (!isSupabaseConfigured()) {
    return true;
  }

  const { error } = await supabase
    .from('folders')
    .update({ name: name.trim() })
    .eq('id', folderId);

  if (error) {
    console.error('Error renaming folder:', error);
    return Boolean(userId);
  }
  return true;
}

export async function deleteFolder(folderId: string): Promise<boolean> {
  const userId = findFolderUserId(folderId);
  if (userId) {
    updateFoldersCache(userId, (folders) => folders.filter((folder) => folder.id !== folderId));
  }

  if (!isSupabaseConfigured()) {
    return true;
  }

  const { error } = await supabase
    .from('folders')
    .delete()
    .eq('id', folderId);

  if (error) {
    console.error('Error deleting folder:', error);
    return Boolean(userId);
  }
  return true;
}

export async function moveChatToFolder(
  conversationId: string,
  folderId: string | null
): Promise<boolean> {
  updateConversationFolderCache(conversationId, folderId);

  if (!isSupabaseConfigured()) {
    return true;
  }

  const { error } = await supabase
    .from('conversations')
    .update({ folder_id: folderId })
    .eq('id', conversationId);

  if (error) {
    console.error('Error moving chat to folder:', error);
    return true;
  }
  return true;
}
