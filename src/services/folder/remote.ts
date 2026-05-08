import { supabase } from '../../lib/supabase';
import { loadAccessibleFolderShares, loadOutgoingFolderShares } from '../share-service';
import type { Folder, OutgoingFolderShareSnapshot } from './types';
import { decorateOwnedFolder, decorateSharedFolder, dedupeFolders } from './normalizers';

export async function fetchAccessibleFolders(
  userId: string,
  accessUserIds: string[],
  orgId?: string,
): Promise<Folder[]> {
  const [ownedResult, sharedShares, outgoingShares] = await Promise.all([
    supabase
      .from('folders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    loadAccessibleFolderShares(accessUserIds, orgId),
    loadOutgoingFolderShares(userId, orgId),
  ]);

  if (ownedResult.error) {
    console.error('[folder-service] fetch owned folders FAILED:', ownedResult.error.message, '| code:', ownedResult.error.code);
    throw ownedResult.error;
  }

  const outgoingShareMap = new Map<string, OutgoingFolderShareSnapshot>();
  for (const share of outgoingShares) {
    const existing = outgoingShareMap.get(share.folder_id);
    if (!existing || (share.share_token && !existing.share_token)) {
      outgoingShareMap.set(share.folder_id, {
        share_token: share.share_token ?? null,
        created_at: share.created_at,
      });
    }
  }

  const ownedFolders = (ownedResult.data || []).map((folder: any) =>
    decorateOwnedFolder(folder, outgoingShareMap.get(folder.id)),
  );
  const sharedFolders = sharedShares
    .filter((share) => share.folder)
    .map((share) => decorateSharedFolder(share.folder, share));

  return dedupeFolders([...ownedFolders, ...sharedFolders]);
}
