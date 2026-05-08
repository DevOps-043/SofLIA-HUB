import type { Folder } from '../../services/folder-service';

export function areFolderListsEqual(left: Folder[], right: Folder[]): boolean {
  if (left.length !== right.length) return false;

  return left.every((folder, index) => {
    const other = right[index];
    return (
      folder.id === other?.id &&
      folder.name === other?.name &&
      folder.updated_at === other?.updated_at &&
      folder.is_shared === other?.is_shared &&
      folder.share_permission === other?.share_permission &&
      folder.can_edit === other?.can_edit &&
      folder.can_share === other?.can_share
    );
  });
}
