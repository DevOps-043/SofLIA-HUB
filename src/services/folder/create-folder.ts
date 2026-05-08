import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import type { Folder } from './types';
import { updateFoldersCache } from './cache';
import { decorateOwnedFolder, normalizeFolder } from './normalizers';

export async function createFolder(userId: string, name: string, orgId?: string): Promise<Folder | null> {
  const trimmedName = name.trim();
  if (!trimmedName) return null;

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

  if (!isSupabaseConfigured()) return localFolder;

  const row: Record<string, any> = { user_id: userId, name: trimmedName };
  if (orgId) row.org_id = orgId;

  const { data, error } = await supabase.from('folders').insert(row).select().single();
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
