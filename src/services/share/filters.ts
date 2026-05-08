import { normalizeUserIds } from './normalizers';

export function applyAccessibleShareFilter(query: any, userIds: string | string[], orgId?: string) {
  const normalizedUserIds = normalizeUserIds(userIds);
  const directFilter =
    normalizedUserIds.length > 0
      ? `shared_with_user_id.in.(${normalizedUserIds.join(',')})`
      : null;

  if (orgId && directFilter) {
    return query.or(`${directFilter},and(shared_with_user_id.is.null,org_id.eq.${orgId})`);
  }

  if (orgId) {
    return query.is('shared_with_user_id', null).eq('org_id', orgId);
  }

  if (normalizedUserIds.length > 0) {
    return query.in('shared_with_user_id', normalizedUserIds);
  }

  return query.eq('shared_with_user_id', '__no_match__');
}
