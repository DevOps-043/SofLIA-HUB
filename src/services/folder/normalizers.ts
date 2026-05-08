import type { ShareAccessLevel } from '../share-service';
import type { Folder, OutgoingFolderShareSnapshot, SharedFolderAccessSnapshot } from './types';

function getAccessRank(access: ShareAccessLevel | undefined): number {
  if (access === 'owner') return 3;
  if (access === 'edit') return 2;
  return 1;
}

export function normalizeFolder(raw: any): Folder {
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

export function decorateOwnedFolder(raw: any, activeShare?: OutgoingFolderShareSnapshot | null): Folder {
  return normalizeFolder({
    ...raw,
    is_shared: Boolean(activeShare),
    share_permission: 'owner',
    can_edit: true,
    can_share: true,
    shared_by_user_id: undefined,
    share_token: activeShare?.share_token ?? null,
    shared_at: activeShare?.created_at ?? undefined,
  });
}

export function decorateSharedFolder(raw: any, share: SharedFolderAccessSnapshot): Folder {
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
  if (rightRank !== leftRank) return rightRank > leftRank ? right : left;

  const leftUpdated = new Date(left.updated_at || left.created_at || 0).getTime();
  const rightUpdated = new Date(right.updated_at || right.created_at || 0).getTime();
  return rightUpdated >= leftUpdated ? right : left;
}

export function dedupeFolders(folders: Folder[]): Folder[] {
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
