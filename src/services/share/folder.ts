import { isSupabaseConfigured } from '../../lib/supabase';
import { loadExistingFolderShare } from './existing';
import { resolveTargetProfileByEmail } from './profiles';
import type { FolderShare, SharePermission } from './types';
import { upsertFolderShareRow } from './upserts';

export async function shareFolderWithEmail(
  folderId: string,
  sharedByUserId: string,
  targetEmail: string,
  orgId: string,
  permission: SharePermission,
): Promise<FolderShare> {
  if (!isSupabaseConfigured()) throw new Error('Lia no esta configurado en este entorno.');
  const targetProfile = await resolveTargetProfileByEmail(targetEmail);
  return shareFolderWithTarget(folderId, sharedByUserId, targetProfile.id, orgId, permission);
}

export async function shareFolderWithUserId(
  folderId: string,
  sharedByUserId: string,
  sharedWithUserId: string,
  orgId: string,
  permission: SharePermission,
): Promise<FolderShare> {
  if (!isSupabaseConfigured()) throw new Error('Lia no esta configurado en este entorno.');
  const targetUserId = sharedWithUserId?.trim();
  if (!targetUserId) throw new Error('No encontre un identificador valido para compartir esta carpeta.');
  return shareFolderWithTarget(folderId, sharedByUserId, targetUserId, orgId, permission);
}

async function shareFolderWithTarget(
  folderId: string,
  sharedByUserId: string,
  targetUserId: string,
  orgId: string,
  permission: SharePermission,
): Promise<FolderShare> {
  const existing = await loadExistingFolderShare(folderId, orgId, targetUserId);
  if (existing?.permission === permission) return existing;
  return upsertFolderShareRow({
    id: existing?.id,
    folder_id: folderId,
    shared_by: sharedByUserId,
    shared_with_user_id: targetUserId,
    org_id: orgId,
    permission,
    share_token: existing?.share_token ?? null,
    is_active: true,
    revoked_at: null,
  });
}
