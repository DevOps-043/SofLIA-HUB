import { isSupabaseConfigured, supabase } from '../lib/supabase';

export type ShareTargetType = 'conversation' | 'folder';
export type SharePermission = 'view' | 'edit';
export type ShareAccessLevel = 'owner' | SharePermission;

export interface LiaProfile {
  id: string;
  email?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  username?: string | null;
}

interface ShareRecordBase {
  id: string;
  shared_by_user_id: string;
  shared_with_user_id: string | null;
  org_id: string;
  permission: SharePermission;
  share_token?: string | null;
  is_active: boolean;
  created_at: string;
  revoked_at?: string | null;
}

export interface ConversationShare extends ShareRecordBase {
  conversation_id: string;
}

export interface FolderShare extends ShareRecordBase {
  folder_id: string;
}

export interface AccessibleConversationShare extends ConversationShare {
  conversation?: Record<string, any> | null;
}

export interface AccessibleFolderShare extends FolderShare {
  folder?: Record<string, any> | null;
}

export interface ResolvedShareTarget {
  targetType: ShareTargetType;
  targetId: string;
  permission: SharePermission;
  shareToken: string;
  orgId: string;
}

function normalizeEmail(email?: string | null): string | null {
  const normalized = email?.trim().toLowerCase();
  return normalized || null;
}

function normalizeShareToken(shareTokenOrUrl: string): string | null {
  const rawValue = shareTokenOrUrl?.trim();
  if (!rawValue) {
    return null;
  }

  if (rawValue.startsWith('soflia://share/')) {
    return rawValue.slice('soflia://share/'.length).trim() || null;
  }

  return rawValue;
}

function normalizeUserIds(userIds: string | string[] | null | undefined): string[] {
  return Array.from(
    new Set(
      (Array.isArray(userIds) ? userIds : [userIds])
        .map((userId) => userId?.trim())
        .filter((userId): userId is string => Boolean(userId)),
    ),
  );
}

function normalizeProfile(raw: any): LiaProfile {
  return {
    id: raw.id,
    email: raw.email ?? null,
    full_name: raw.full_name ?? null,
    avatar_url: raw.avatar_url ?? null,
    username: raw.username ?? null,
  };
}

function normalizeConversationShare(raw: any): ConversationShare {
  return {
    id: raw.id,
    conversation_id: raw.conversation_id,
    shared_by_user_id: raw.shared_by_user_id ?? raw.shared_by,
    shared_with_user_id: raw.shared_with_user_id ?? null,
    org_id: raw.org_id,
    permission: raw.permission === 'edit' ? 'edit' : 'view',
    share_token: raw.share_token ?? null,
    is_active: raw.is_active ?? true,
    created_at: raw.created_at,
    revoked_at: raw.revoked_at ?? null,
  };
}

function normalizeFolderShare(raw: any): FolderShare {
  return {
    id: raw.id,
    folder_id: raw.folder_id,
    shared_by_user_id: raw.shared_by_user_id ?? raw.shared_by,
    shared_with_user_id: raw.shared_with_user_id ?? null,
    org_id: raw.org_id,
    permission: raw.permission === 'edit' ? 'edit' : 'view',
    share_token: raw.share_token ?? null,
    is_active: raw.is_active ?? true,
    created_at: raw.created_at,
    revoked_at: raw.revoked_at ?? null,
  };
}

function buildShareToken(prefix: 'conv' | 'fold'): string {
  const token = crypto.randomUUID().replace(/-/g, '');
  return `${prefix}_${token}`;
}

async function resolveTargetProfileByEmail(email: string): Promise<LiaProfile> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new Error('El miembro seleccionado no tiene un correo valido en SOFIA.');
  }

  const profilesByEmail = await resolveLiaProfilesByEmails([normalizedEmail]);
  const profile = profilesByEmail.get(normalizedEmail);

  if (!profile?.id) {
    throw new Error(
      'Ese miembro aun no tiene perfil activo en Lia. Necesita iniciar sesion al menos una vez para habilitar chats compartidos.',
    );
  }

  return profile;
}

export async function resolveLiaProfilesByEmails(emails: string[]): Promise<Map<string, LiaProfile>> {
  const normalizedEmails = Array.from(
    new Set(
      emails
        .map((email) => normalizeEmail(email))
        .filter((email): email is string => Boolean(email)),
    ),
  );

  if (!isSupabaseConfigured() || normalizedEmails.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url, username')
    .in('email', normalizedEmails);

  if (error) {
    console.error('[share-service] resolveLiaProfilesByEmails FAILED:', error.message, '| code:', error.code);
    return new Map();
  }

  return new Map(
    (data || [])
      .map((profile: any) => normalizeProfile(profile))
      .map((profile) => [normalizeEmail(profile.email)!, profile]),
  );
}

function applyAccessibleShareFilter(query: any, userIds: string | string[], orgId?: string) {
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

async function loadExistingConversationShare(
  conversationId: string,
  orgId: string,
  sharedWithUserId: string | null,
): Promise<ConversationShare | null> {
  let query = supabase
    .from('conversation_shares')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('org_id', orgId)
    .eq('is_active', true);

  query = sharedWithUserId ? query.eq('shared_with_user_id', sharedWithUserId) : query.is('shared_with_user_id', null);

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('[share-service] loadExistingConversationShare FAILED:', error.message, '| code:', error.code);
    return null;
  }

  return data?.[0] ? normalizeConversationShare(data[0]) : null;
}

async function loadExistingFolderShare(
  folderId: string,
  orgId: string,
  sharedWithUserId: string | null,
): Promise<FolderShare | null> {
  let query = supabase
    .from('folder_shares')
    .select('*')
    .eq('folder_id', folderId)
    .eq('org_id', orgId)
    .eq('is_active', true);

  query = sharedWithUserId ? query.eq('shared_with_user_id', sharedWithUserId) : query.is('shared_with_user_id', null);

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('[share-service] loadExistingFolderShare FAILED:', error.message, '| code:', error.code);
    return null;
  }

  return data?.[0] ? normalizeFolderShare(data[0]) : null;
}

async function upsertConversationShareRow(payload: Record<string, any>): Promise<ConversationShare> {
  const { data, error } = await supabase
    .from('conversation_shares')
    .upsert(payload, { onConflict: 'id' })
    .select('*')
    .single();

  if (error) {
    console.error('[share-service] upsertConversationShareRow FAILED:', error.message, '| code:', error.code);
    throw new Error(error.message || 'No se pudo guardar la comparticion de la conversacion.');
  }

  return normalizeConversationShare(data);
}

async function upsertFolderShareRow(payload: Record<string, any>): Promise<FolderShare> {
  const { data, error } = await supabase
    .from('folder_shares')
    .upsert(payload, { onConflict: 'id' })
    .select('*')
    .single();

  if (error) {
    console.error('[share-service] upsertFolderShareRow FAILED:', error.message, '| code:', error.code);
    throw new Error(error.message || 'No se pudo guardar la comparticion de la carpeta.');
  }

  return normalizeFolderShare(data);
}

export async function shareConversationWithEmail(
  conversationId: string,
  sharedByUserId: string,
  targetEmail: string,
  orgId: string,
  permission: SharePermission,
): Promise<ConversationShare> {
  if (!isSupabaseConfigured()) {
    throw new Error('Lia no esta configurado en este entorno.');
  }

  const targetProfile = await resolveTargetProfileByEmail(targetEmail);
  const existing = await loadExistingConversationShare(conversationId, orgId, targetProfile.id);

  if (existing) {
    if (existing.permission === permission) {
      return existing;
    }

    return upsertConversationShareRow({
      id: existing.id,
      conversation_id: conversationId,
      shared_by: sharedByUserId,
      shared_with_user_id: targetProfile.id,
      org_id: orgId,
      permission,
      share_token: existing.share_token ?? null,
      is_active: true,
      revoked_at: null,
    });
  }

  return upsertConversationShareRow({
    conversation_id: conversationId,
    shared_by: sharedByUserId,
    shared_with_user_id: targetProfile.id,
    org_id: orgId,
    permission,
  });
}

export async function shareConversationWithUserId(
  conversationId: string,
  sharedByUserId: string,
  sharedWithUserId: string,
  orgId: string,
  permission: SharePermission,
): Promise<ConversationShare> {
  if (!isSupabaseConfigured()) {
    throw new Error('Lia no esta configurado en este entorno.');
  }

  const targetUserId = sharedWithUserId?.trim();
  if (!targetUserId) {
    throw new Error('No encontre un identificador valido para compartir esta conversacion.');
  }

  const existing = await loadExistingConversationShare(conversationId, orgId, targetUserId);

  if (existing) {
    if (existing.permission === permission) {
      return existing;
    }

    return upsertConversationShareRow({
      id: existing.id,
      conversation_id: conversationId,
      shared_by: sharedByUserId,
      shared_with_user_id: targetUserId,
      org_id: orgId,
      permission,
      share_token: existing.share_token ?? null,
      is_active: true,
      revoked_at: null,
    });
  }

  return upsertConversationShareRow({
    conversation_id: conversationId,
    shared_by: sharedByUserId,
    shared_with_user_id: targetUserId,
    org_id: orgId,
    permission,
  });
}

export async function shareFolderWithEmail(
  folderId: string,
  sharedByUserId: string,
  targetEmail: string,
  orgId: string,
  permission: SharePermission,
): Promise<FolderShare> {
  if (!isSupabaseConfigured()) {
    throw new Error('Lia no esta configurado en este entorno.');
  }

  const targetProfile = await resolveTargetProfileByEmail(targetEmail);
  const existing = await loadExistingFolderShare(folderId, orgId, targetProfile.id);

  if (existing) {
    if (existing.permission === permission) {
      return existing;
    }

    return upsertFolderShareRow({
      id: existing.id,
      folder_id: folderId,
      shared_by: sharedByUserId,
      shared_with_user_id: targetProfile.id,
      org_id: orgId,
      permission,
      share_token: existing.share_token ?? null,
      is_active: true,
      revoked_at: null,
    });
  }

  return upsertFolderShareRow({
    folder_id: folderId,
    shared_by: sharedByUserId,
    shared_with_user_id: targetProfile.id,
    org_id: orgId,
    permission,
  });
}

export async function shareFolderWithUserId(
  folderId: string,
  sharedByUserId: string,
  sharedWithUserId: string,
  orgId: string,
  permission: SharePermission,
): Promise<FolderShare> {
  if (!isSupabaseConfigured()) {
    throw new Error('Lia no esta configurado en este entorno.');
  }

  const targetUserId = sharedWithUserId?.trim();
  if (!targetUserId) {
    throw new Error('No encontre un identificador valido para compartir esta carpeta.');
  }

  const existing = await loadExistingFolderShare(folderId, orgId, targetUserId);

  if (existing) {
    if (existing.permission === permission) {
      return existing;
    }

    return upsertFolderShareRow({
      id: existing.id,
      folder_id: folderId,
      shared_by: sharedByUserId,
      shared_with_user_id: targetUserId,
      org_id: orgId,
      permission,
      share_token: existing.share_token ?? null,
      is_active: true,
      revoked_at: null,
    });
  }

  return upsertFolderShareRow({
    folder_id: folderId,
    shared_by: sharedByUserId,
    shared_with_user_id: targetUserId,
    org_id: orgId,
    permission,
  });
}

export async function generateConversationShareLink(
  conversationId: string,
  sharedByUserId: string,
  orgId: string,
  permission: SharePermission,
): Promise<string> {
  if (!isSupabaseConfigured()) {
    throw new Error('Lia no esta configurado en este entorno.');
  }

  const existing = await loadExistingConversationShare(conversationId, orgId, null);
  const shareToken = existing?.share_token || buildShareToken('conv');

  await upsertConversationShareRow({
    id: existing?.id,
    conversation_id: conversationId,
    shared_by: sharedByUserId,
    shared_with_user_id: null,
    org_id: orgId,
    permission,
    share_token: shareToken,
    is_active: true,
    revoked_at: null,
  });

  return shareToken;
}

export async function generateFolderShareLink(
  folderId: string,
  sharedByUserId: string,
  orgId: string,
  permission: SharePermission,
): Promise<string> {
  if (!isSupabaseConfigured()) {
    throw new Error('Lia no esta configurado en este entorno.');
  }

  const existing = await loadExistingFolderShare(folderId, orgId, null);
  const shareToken = existing?.share_token || buildShareToken('fold');

  await upsertFolderShareRow({
    id: existing?.id,
    folder_id: folderId,
    shared_by: sharedByUserId,
    shared_with_user_id: null,
    org_id: orgId,
    permission,
    share_token: shareToken,
    is_active: true,
    revoked_at: null,
  });

  return shareToken;
}

export async function loadConversationShares(conversationId: string): Promise<ConversationShare[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const { data, error } = await supabase
    .from('conversation_shares')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[share-service] loadConversationShares FAILED:', error.message, '| code:', error.code);
    return [];
  }

  return (data || []).map((share: any) => normalizeConversationShare(share));
}

export async function loadOutgoingConversationShares(
  sharedByUserId: string,
  orgId?: string,
): Promise<ConversationShare[]> {
  const normalizedUserId = sharedByUserId?.trim();
  if (!normalizedUserId || !isSupabaseConfigured()) {
    return [];
  }

  let query = supabase
    .from('conversation_shares')
    .select('*')
    .eq('shared_by', normalizedUserId)
    .eq('is_active', true);

  if (orgId) {
    query = query.eq('org_id', orgId);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('[share-service] loadOutgoingConversationShares FAILED:', error.message, '| code:', error.code);
    return [];
  }

  return (data || []).map((share: any) => normalizeConversationShare(share));
}

export async function loadFolderShares(folderId: string): Promise<FolderShare[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const { data, error } = await supabase
    .from('folder_shares')
    .select('*')
    .eq('folder_id', folderId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[share-service] loadFolderShares FAILED:', error.message, '| code:', error.code);
    return [];
  }

  return (data || []).map((share: any) => normalizeFolderShare(share));
}

export async function loadOutgoingFolderShares(
  sharedByUserId: string,
  orgId?: string,
): Promise<FolderShare[]> {
  const normalizedUserId = sharedByUserId?.trim();
  if (!normalizedUserId || !isSupabaseConfigured()) {
    return [];
  }

  let query = supabase
    .from('folder_shares')
    .select('*')
    .eq('shared_by', normalizedUserId)
    .eq('is_active', true);

  if (orgId) {
    query = query.eq('org_id', orgId);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('[share-service] loadOutgoingFolderShares FAILED:', error.message, '| code:', error.code);
    return [];
  }

  return (data || []).map((share: any) => normalizeFolderShare(share));
}

export async function revokeShare(shareId: string, targetType: ShareTargetType): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  const table = targetType === 'conversation' ? 'conversation_shares' : 'folder_shares';
  const { error } = await supabase
    .from(table)
    .update({ is_active: false, revoked_at: new Date().toISOString() })
    .eq('id', shareId);

  if (error) {
    console.error('[share-service] revokeShare FAILED:', error.message, '| code:', error.code);
    return false;
  }

  return true;
}

export async function loadAccessibleConversationShares(
  userIds: string | string[],
  orgId?: string,
): Promise<AccessibleConversationShare[]> {
  const normalizedUserIds = normalizeUserIds(userIds);
  if ((normalizedUserIds.length === 0 && !orgId) || !isSupabaseConfigured()) {
    return [];
  }

  let query = supabase
    .from('conversation_shares')
    .select('id, conversation_id, shared_by, shared_with_user_id, org_id, permission, share_token, is_active, created_at, revoked_at, conversation:conversations(*)')
    .eq('is_active', true);

  if (orgId) {
    query = query.eq('org_id', orgId);
  }

  query = applyAccessibleShareFilter(query, normalizedUserIds, orgId);

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('[share-service] loadAccessibleConversationShares FAILED:', error.message, '| code:', error.code);
    return [];
  }

  return (data || []).map((share: any) => ({
    ...normalizeConversationShare(share),
    conversation: share.conversation || null,
  }));
}

export async function loadAccessibleFolderShares(
  userIds: string | string[],
  orgId?: string,
): Promise<AccessibleFolderShare[]> {
  const normalizedUserIds = normalizeUserIds(userIds);
  if ((normalizedUserIds.length === 0 && !orgId) || !isSupabaseConfigured()) {
    return [];
  }

  let query = supabase
    .from('folder_shares')
    .select('id, folder_id, shared_by, shared_with_user_id, org_id, permission, share_token, is_active, created_at, revoked_at, folder:folders(*)')
    .eq('is_active', true);

  if (orgId) {
    query = query.eq('org_id', orgId);
  }

  query = applyAccessibleShareFilter(query, normalizedUserIds, orgId);

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('[share-service] loadAccessibleFolderShares FAILED:', error.message, '| code:', error.code);
    return [];
  }

  return (data || []).map((share: any) => ({
    ...normalizeFolderShare(share),
    folder: share.folder || null,
  }));
}

export async function resolveShareTargetByToken(
  shareTokenOrUrl: string,
  orgId?: string,
): Promise<ResolvedShareTarget | null> {
  const shareToken = normalizeShareToken(shareTokenOrUrl);
  if (!shareToken || !isSupabaseConfigured()) {
    return null;
  }

  let conversationQuery = supabase
    .from('conversation_shares')
    .select('conversation_id, org_id, permission, share_token')
    .eq('share_token', shareToken)
    .eq('is_active', true);

  if (orgId) {
    conversationQuery = conversationQuery.eq('org_id', orgId);
  }

  const { data: conversationRows, error: conversationError } = await conversationQuery.limit(1);

  if (conversationError) {
    console.error('[share-service] resolveShareTargetByToken conversation FAILED:', conversationError.message, '| code:', conversationError.code);
  } else if (conversationRows?.[0]?.conversation_id && conversationRows[0]?.share_token) {
    return {
      targetType: 'conversation',
      targetId: conversationRows[0].conversation_id,
      permission: conversationRows[0].permission === 'edit' ? 'edit' : 'view',
      shareToken: conversationRows[0].share_token,
      orgId: conversationRows[0].org_id,
    };
  }

  let folderQuery = supabase
    .from('folder_shares')
    .select('folder_id, org_id, permission, share_token')
    .eq('share_token', shareToken)
    .eq('is_active', true);

  if (orgId) {
    folderQuery = folderQuery.eq('org_id', orgId);
  }

  const { data: folderRows, error: folderError } = await folderQuery.limit(1);

  if (folderError) {
    console.error('[share-service] resolveShareTargetByToken folder FAILED:', folderError.message, '| code:', folderError.code);
    return null;
  }

  if (!folderRows?.[0]?.folder_id || !folderRows[0]?.share_token) {
    return null;
  }

  return {
    targetType: 'folder',
    targetId: folderRows[0].folder_id,
    permission: folderRows[0].permission === 'edit' ? 'edit' : 'view',
    shareToken: folderRows[0].share_token,
    orgId: folderRows[0].org_id,
  };
}
