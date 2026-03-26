import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { app } from 'electron';
import * as dotenv from 'dotenv';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { DriveService } from './drive-service';
import { getWhatsAppSession, tryAutoAuthByPhone } from './iris-data-main';
import { normalizeComparableText } from './whatsapp-text';

interface AppChatConversationRow {
  id: string;
  user_id: string;
  title: string;
  folder_id?: string | null;
  org_id?: string | null;
  is_pinned?: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface AppChatConversationSummary {
  id: string;
  title: string;
  folder_id?: string | null;
  org_id?: string | null;
  created_at: string;
  updated_at: string;
  permission: 'owner' | 'edit' | 'view';
  is_shared: boolean;
  owner_user_id: string;
}

export interface AppChatContextMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  created_at: string;
  sources_count: number;
  images_count: number;
  feedback?: 'like' | 'dislike';
}

export interface AppChatAssetSummary {
  asset_ref: string;
  file_name: string;
  created_at: string;
  kind: 'workspace_source' | 'message_image';
  sendable: boolean;
  source_type?: string | null;
  mime_type?: string | null;
  file_size?: number | null;
  external_url?: string | null;
}

interface ResolvedWhatsAppUser {
  userId: string;
  email: string | null;
  fullName: string | null;
  orgIds: string[];
}

interface PreparedAppChatAsset {
  localPath: string;
  caption: string;
  cleanupAfterSend: boolean;
}

interface InternalAssetRecord extends AppChatAssetSummary {
  message_id?: string;
  image_data?: string | null;
  storage_path?: string | null;
  external_file_id?: string | null;
}

let envLoaded = false;
let liaClient: SupabaseClient | null = null;
let sofiaClient: SupabaseClient | null = null;

function ensureEnvLoaded(): void {
  if (envLoaded) {
    return;
  }

  try {
    const envPath = path.join(app.getAppPath(), '.env');
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
    }
  } catch (error) {
    console.warn('[AppChatService] No pude cargar .env:', error);
  }

  envLoaded = true;
}

function getLiaClient(): SupabaseClient | null {
  if (liaClient) {
    return liaClient;
  }

  ensureEnvLoaded();

  const url = process.env.VITE_SUPABASE_URL || '';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    '';

  if (!url || !key) {
    console.warn('[AppChatService] Lia no esta configurado en el entorno.');
    return null;
  }

  liaClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return liaClient;
}

function getSofiaClient(): SupabaseClient | null {
  if (sofiaClient) {
    return sofiaClient;
  }

  ensureEnvLoaded();

  const url = process.env.VITE_SOFIA_SUPABASE_URL || '';
  const key =
    process.env.SOFIA_SERVICE_ROLE_KEY ||
    process.env.VITE_SOFIA_SUPABASE_ANON_KEY ||
    '';

  if (!url || !key) {
    return null;
  }

  sofiaClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return sofiaClient;
}

function normalizeForMatch(value: string | null | undefined): string {
  return normalizeComparableText(String(value || ''))
    .replace(/\s+/g, ' ')
    .trim();
}

function getPermissionRank(permission: 'owner' | 'edit' | 'view'): number {
  if (permission === 'owner') return 3;
  if (permission === 'edit') return 2;
  return 1;
}

function dedupeConversations(conversations: AppChatConversationSummary[]): AppChatConversationSummary[] {
  const byId = new Map<string, AppChatConversationSummary>();

  for (const conversation of conversations) {
    const existing = byId.get(conversation.id);
    if (!existing) {
      byId.set(conversation.id, conversation);
      continue;
    }

    const existingRank = getPermissionRank(existing.permission);
    const nextRank = getPermissionRank(conversation.permission);
    if (nextRank > existingRank) {
      byId.set(conversation.id, conversation);
      continue;
    }

    if (nextRank === existingRank) {
      const existingUpdated = new Date(existing.updated_at || existing.created_at || 0).getTime();
      const nextUpdated = new Date(conversation.updated_at || conversation.created_at || 0).getTime();
      if (nextUpdated >= existingUpdated) {
        byId.set(conversation.id, conversation);
      }
    }
  }

  return Array.from(byId.values()).sort(
    (left, right) =>
      new Date(right.updated_at || right.created_at).getTime() -
      new Date(left.updated_at || left.created_at).getTime(),
  );
}

function rowToConversationSummary(
  row: AppChatConversationRow,
  permission: 'owner' | 'edit' | 'view',
  isShared: boolean,
): AppChatConversationSummary {
  return {
    id: row.id,
    title: row.title || 'Nueva conversacion',
    folder_id: row.folder_id ?? null,
    org_id: row.org_id ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    permission,
    is_shared: isShared,
    owner_user_id: row.user_id,
  };
}

function unwrapConversationRow(value: any): AppChatConversationRow | null {
  if (!value) {
    return null;
  }

  const row = Array.isArray(value) ? value[0] : value;
  if (!row?.id) {
    return null;
  }

  return row as AppChatConversationRow;
}

async function resolveWhatsAppUser(phoneNumber: string): Promise<ResolvedWhatsAppUser> {
  let session = getWhatsAppSession(phoneNumber);
  if (!session) {
    const autoAuth = await tryAutoAuthByPhone(phoneNumber);
    if (autoAuth.success && autoAuth.session) {
      session = autoAuth.session;
    }
  }

  if (!session?.userId) {
    throw new Error(
      'No pude identificar tu cuenta de SofLIA para acceder a tus conversaciones. Asegurate de tener tu numero ligado a tu perfil.',
    );
  }

  const orgIds = await loadActiveOrganizationIds(session.userId);
  return {
    userId: session.userId,
    email: session.email || null,
    fullName: session.fullName || null,
    orgIds,
  };
}

async function loadActiveOrganizationIds(userId: string): Promise<string[]> {
  const sofia = getSofiaClient();
  if (!sofia || !userId) {
    return [];
  }

  try {
    const { data, error } = await sofia
      .from('organization_users')
      .select('organization_id, status')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (error) {
      console.warn('[AppChatService] No pude cargar organizaciones activas:', error.message);
      return [];
    }

    return Array.from(
      new Set((data || []).map((row: any) => String(row.organization_id || '').trim()).filter(Boolean)),
    );
  } catch (error) {
    console.warn('[AppChatService] Error cargando organizaciones activas:', error);
    return [];
  }
}

async function fetchAccessibleConversations(userId: string, orgIds: string[]): Promise<AppChatConversationSummary[]> {
  const lia = getLiaClient();
  if (!lia) {
    throw new Error('Lia no esta configurado en este dispositivo.');
  }

  const ownPromise = lia
    .from('conversations')
    .select('id, user_id, title, folder_id, org_id, is_pinned, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(200);

  const directConversationSharesPromise = lia
    .from('conversation_shares')
    .select('permission, conversation:conversations(id, user_id, title, folder_id, org_id, is_pinned, created_at, updated_at)')
    .eq('is_active', true)
    .eq('shared_with_user_id', userId);

  const orgConversationSharesPromise = orgIds.length > 0
    ? lia
      .from('conversation_shares')
      .select('permission, conversation:conversations(id, user_id, title, folder_id, org_id, is_pinned, created_at, updated_at)')
      .eq('is_active', true)
      .is('shared_with_user_id', null)
      .in('org_id', orgIds)
    : Promise.resolve({ data: [], error: null });

  const directFolderSharesPromise = lia
    .from('folder_shares')
    .select('folder_id, permission')
    .eq('is_active', true)
    .eq('shared_with_user_id', userId);

  const orgFolderSharesPromise = orgIds.length > 0
    ? lia
      .from('folder_shares')
      .select('folder_id, permission')
      .eq('is_active', true)
      .is('shared_with_user_id', null)
      .in('org_id', orgIds)
    : Promise.resolve({ data: [], error: null });

  const [
    ownResult,
    directConversationSharesResult,
    orgConversationSharesResult,
    directFolderSharesResult,
    orgFolderSharesResult,
  ] = await Promise.all([
    ownPromise,
    directConversationSharesPromise,
    orgConversationSharesPromise,
    directFolderSharesPromise,
    orgFolderSharesPromise,
  ]);

  const errors = [
    ownResult.error,
    directConversationSharesResult.error,
    orgConversationSharesResult.error,
    directFolderSharesResult.error,
    orgFolderSharesResult.error,
  ].filter(Boolean);

  if (errors.length > 0) {
    throw new Error(errors[0]?.message || 'No pude cargar las conversaciones accesibles.');
  }

  const accessible: AppChatConversationSummary[] = (ownResult.data || []).map((row: any) =>
    rowToConversationSummary(row, 'owner', false),
  );

  for (const share of [...(directConversationSharesResult.data || []), ...(orgConversationSharesResult.data || [])]) {
    const conversationRow = unwrapConversationRow(share?.conversation);
    if (!conversationRow) continue;
    accessible.push(
      rowToConversationSummary(
        conversationRow,
        share.permission === 'edit' ? 'edit' : 'view',
        true,
      ),
    );
  }

  const folderPermissionById = new Map<string, 'edit' | 'view'>();
  for (const share of [...(directFolderSharesResult.data || []), ...(orgFolderSharesResult.data || [])]) {
    const folderId = String(share?.folder_id || '').trim();
    if (!folderId) continue;
    const permission = share?.permission === 'edit' ? 'edit' : 'view';
    const existing = folderPermissionById.get(folderId);
    if (!existing || getPermissionRank(permission) > getPermissionRank(existing)) {
      folderPermissionById.set(folderId, permission);
    }
  }

  const folderIds = Array.from(folderPermissionById.keys());
  if (folderIds.length > 0) {
    const { data: folderConversations, error: folderConversationError } = await lia
      .from('conversations')
      .select('id, user_id, title, folder_id, org_id, is_pinned, created_at, updated_at')
      .in('folder_id', folderIds)
      .order('updated_at', { ascending: false })
      .limit(200);

    if (folderConversationError) {
      throw new Error(folderConversationError.message);
    }

    for (const row of folderConversations || []) {
      const permission = folderPermissionById.get(String(row.folder_id || ''));
      if (!permission) continue;
      accessible.push(rowToConversationSummary(row as AppChatConversationRow, permission, true));
    }
  }

  return dedupeConversations(accessible);
}

function pickConversationByReference(
  conversations: AppChatConversationSummary[],
  conversationRef: string,
): AppChatConversationSummary {
  const rawRef = String(conversationRef || '').trim();
  if (!rawRef) {
    throw new Error('Debes indicar el nombre o ID de la conversacion.');
  }

  const exactId = conversations.find((conversation) => conversation.id === rawRef);
  if (exactId) {
    return exactId;
  }

  const normalizedRef = normalizeForMatch(rawRef);
  const scored = conversations
    .map((conversation) => {
      const normalizedTitle = normalizeForMatch(conversation.title);
      let score = 0;

      if (normalizedTitle === normalizedRef) score = 1000;
      else if (normalizedTitle.startsWith(normalizedRef)) score = 800;
      else if (normalizedTitle.includes(normalizedRef)) score = 700;
      else if (normalizedRef.includes(normalizedTitle) && normalizedTitle.length > 0) score = 650;
      else {
        const refTokens = normalizedRef.split(' ').filter(Boolean);
        const titleTokens = normalizedTitle.split(' ').filter(Boolean);
        const overlap = refTokens.filter((token) => titleTokens.includes(token)).length;
        if (overlap > 0) {
          score = overlap * 100;
        }
      }

      return { conversation, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return (
        new Date(right.conversation.updated_at || right.conversation.created_at).getTime() -
        new Date(left.conversation.updated_at || left.conversation.created_at).getTime()
      );
    });

  if (scored.length === 0) {
    throw new Error(`No encontre una conversacion que coincida con "${rawRef}".`);
  }

  if (scored.length > 1 && scored[0].score === scored[1].score) {
    const options = scored.slice(0, 5).map((item) => `- ${item.conversation.title} (${item.conversation.id})`).join('\n');
    throw new Error(`La referencia "${rawRef}" es ambigua. Opciones:\n${options}`);
  }

  return scored[0].conversation;
}

function truncateSnippet(value: string | null | undefined, maxLength: number = 160): string {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function guessExtensionFromMime(mimeType: string | null | undefined): string {
  const mime = String(mimeType || '').toLowerCase();
  if (mime.includes('png')) return '.png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return '.jpg';
  if (mime.includes('gif')) return '.gif';
  if (mime.includes('webp')) return '.webp';
  if (mime.includes('pdf')) return '.pdf';
  return '.bin';
}

function sanitizeFileName(value: string): string {
  const trimmed = value.trim() || 'archivo';
  return trimmed.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
}

function buildImageAssetFileName(conversation: AppChatConversationSummary, messageCreatedAt: string, index: number, mimeType?: string | null): string {
  const base = sanitizeFileName(conversation.title || 'chat');
  const stamp = messageCreatedAt.replace(/[:.]/g, '-');
  return `${base}_${stamp}_img_${index + 1}${guessExtensionFromMime(mimeType)}`;
}

async function resolveConversationForUser(phoneNumber: string, conversationRef: string): Promise<{
  user: ResolvedWhatsAppUser;
  conversation: AppChatConversationSummary;
}> {
  const user = await resolveWhatsAppUser(phoneNumber);
  const conversations = await fetchAccessibleConversations(user.userId, user.orgIds);
  const conversation = pickConversationByReference(conversations, conversationRef);
  return { user, conversation };
}

export async function listAppChatConversations(
  phoneNumber: string,
  options?: { query?: string; limit?: number },
): Promise<{ success: boolean; conversations?: AppChatConversationSummary[]; error?: string; count?: number }> {
  try {
    const user = await resolveWhatsAppUser(phoneNumber);
    let conversations = await fetchAccessibleConversations(user.userId, user.orgIds);

    const normalizedQuery = normalizeForMatch(options?.query || '');
    if (normalizedQuery) {
      conversations = conversations.filter((conversation) => normalizeForMatch(conversation.title).includes(normalizedQuery));
    }

    const limit = Math.min(Math.max(Number(options?.limit) || 20, 1), 50);
    const trimmed = conversations.slice(0, limit);

    return {
      success: true,
      count: trimmed.length,
      conversations: trimmed,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'No pude listar las conversaciones de la app.',
    };
  }
}

export async function getAppChatConversationContext(
  phoneNumber: string,
  conversationRef: string,
  limit: number = 12,
): Promise<{
  success: boolean;
  conversation?: AppChatConversationSummary;
  messages?: AppChatContextMessage[];
  count?: number;
  error?: string;
}> {
  const lia = getLiaClient();
  if (!lia) {
    return { success: false, error: 'Lia no esta configurado en este dispositivo.' };
  }

  try {
    const { conversation } = await resolveConversationForUser(phoneNumber, conversationRef);
    const safeLimit = Math.min(Math.max(Number(limit) || 12, 1), 50);

    const { data, error } = await lia
      .from('messages')
      .select('id, role, content, metadata, created_at')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: false })
      .limit(safeLimit);

    if (error) {
      throw new Error(error.message);
    }

    const messages = [...(data || [])]
      .reverse()
      .map((message: any) => ({
        id: message.id,
        role: message.role === 'user' ? 'user' : 'model',
        text: truncateSnippet(message.content, 1200),
        created_at: message.created_at,
        sources_count: Array.isArray(message.metadata?.sources) ? message.metadata.sources.length : 0,
        images_count: Array.isArray(message.metadata?.images) ? message.metadata.images.length : 0,
        feedback:
          message.metadata?.feedback === 'like' || message.metadata?.feedback === 'dislike'
            ? message.metadata.feedback
            : undefined,
      })) satisfies AppChatContextMessage[];

    return {
      success: true,
      conversation,
      messages,
      count: messages.length,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'No pude leer el contexto de esa conversacion.',
    };
  }
}

export async function appendNoteToAppConversation(
  phoneNumber: string,
  conversationRef: string,
  content: string,
): Promise<{ success: boolean; error?: string; conversation?: AppChatConversationSummary; messageId?: string }> {
  const lia = getLiaClient();
  if (!lia) {
    return { success: false, error: 'Lia no esta configurado en este dispositivo.' };
  }

  const trimmedContent = String(content || '').trim();
  if (!trimmedContent) {
    return { success: false, error: 'Debes indicar el contenido que quieres agregar.' };
  }

  try {
    const { user, conversation } = await resolveConversationForUser(phoneNumber, conversationRef);

    if (conversation.permission === 'view') {
      return {
        success: false,
        error: `La conversacion "${conversation.title}" esta compartida en solo lectura.`,
      };
    }

    const messageId = randomUUID();
    const createdAt = new Date().toISOString();
    const noteMetadata = {
      source: 'whatsapp_app_chat',
      appended_via: 'whatsapp',
      sender_phone: phoneNumber,
      sender_user_id: user.userId,
      sender_email: user.email,
      sender_name: user.fullName,
    };

    const { error: insertError } = await lia
      .from('messages')
      .insert({
        id: messageId,
        conversation_id: conversation.id,
        user_id: user.userId,
        role: 'user',
        content: trimmedContent,
        metadata: noteMetadata,
        created_at: createdAt,
      });

    if (insertError) {
      throw new Error(insertError.message);
    }

    const { error: updateError } = await lia
      .from('conversations')
      .update({ updated_at: createdAt })
      .eq('id', conversation.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return {
      success: true,
      conversation: {
        ...conversation,
        updated_at: createdAt,
      },
      messageId,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'No pude agregar la nota a la conversacion.',
    };
  }
}

async function buildConversationAssets(
  conversation: AppChatConversationSummary,
): Promise<InternalAssetRecord[]> {
  const lia = getLiaClient();
  if (!lia) {
    throw new Error('Lia no esta configurado en este dispositivo.');
  }

  const [sourcesResult, messagesResult] = await Promise.all([
    lia
      .from('workspace_sources')
      .select('id, source_type, file_name, file_size, mime_type, external_file_id, external_url, storage_path, created_at')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: false })
      .limit(50),
    lia
      .from('messages')
      .select('id, metadata, created_at')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: false })
      .limit(80),
  ]);

  if (sourcesResult.error) {
    throw new Error(sourcesResult.error.message);
  }

  if (messagesResult.error) {
    throw new Error(messagesResult.error.message);
  }

  const assets: InternalAssetRecord[] = [];

  for (const source of sourcesResult.data || []) {
    const storagePath = source.storage_path ? String(source.storage_path).trim() : null;
    const externalUrl = source.external_url ? String(source.external_url).trim() : null;
    const externalFileId = source.external_file_id ? String(source.external_file_id).trim() : null;
    const localExists = storagePath ? fs.existsSync(storagePath) : false;
    const sendable = localExists || Boolean(externalFileId);

    assets.push({
      asset_ref: `source:${source.id}`,
      file_name: source.file_name,
      created_at: source.created_at,
      kind: 'workspace_source',
      sendable,
      source_type: source.source_type ?? null,
      mime_type: source.mime_type ?? null,
      file_size: typeof source.file_size === 'number' ? source.file_size : Number(source.file_size || 0) || null,
      external_url: externalUrl,
      storage_path: storagePath,
      external_file_id: externalFileId,
    });
  }

  for (const message of messagesResult.data || []) {
    const images = Array.isArray(message.metadata?.images) ? message.metadata.images : [];
    images.forEach((image: string, index: number) => {
      const rawImage = String(image || '').trim();
      if (!rawImage) return;

      let mimeType: string | null = null;
      const mimeMatch = rawImage.match(/^data:([^;]+);base64,/i);
      if (mimeMatch?.[1]) {
        mimeType = mimeMatch[1];
      }

      assets.push({
        asset_ref: `msg:${message.id}:img:${index + 1}`,
        file_name: buildImageAssetFileName(conversation, message.created_at, index, mimeType),
        created_at: message.created_at,
        kind: 'message_image',
        sendable: rawImage.startsWith('data:') || path.isAbsolute(rawImage),
        mime_type: mimeType,
        image_data: rawImage,
        message_id: message.id,
      });
    });
  }

  return assets.sort(
    (left, right) =>
      new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
  );
}

function resolveAssetByReference(assets: InternalAssetRecord[], assetRef: string): InternalAssetRecord {
  const rawRef = String(assetRef || '').trim();
  if (!rawRef) {
    throw new Error('Debes indicar el archivo o asset que quieres recuperar.');
  }

  const exact = assets.find((asset) => asset.asset_ref === rawRef);
  if (exact) {
    return exact;
  }

  const normalizedRef = normalizeForMatch(rawRef);
  const scored = assets
    .map((asset) => {
      const normalizedName = normalizeForMatch(asset.file_name);
      let score = 0;

      if (normalizedName === normalizedRef) score = 1000;
      else if (normalizedName.startsWith(normalizedRef)) score = 800;
      else if (normalizedName.includes(normalizedRef)) score = 700;
      else if (asset.kind === 'message_image' && ['imagen', 'image', 'img'].includes(normalizedRef)) score = 500;

      return { asset, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return new Date(right.asset.created_at).getTime() - new Date(left.asset.created_at).getTime();
    });

  if (scored.length === 0) {
    throw new Error(`No encontre un archivo o asset que coincida con "${rawRef}".`);
  }

  if (scored.length > 1 && scored[0].score === scored[1].score) {
    const options = scored.slice(0, 5).map((item) => `- ${item.asset.file_name} (${item.asset.asset_ref})`).join('\n');
    throw new Error(`La referencia "${rawRef}" es ambigua. Opciones:\n${options}`);
  }

  return scored[0].asset;
}

export async function listAppChatConversationAssets(
  phoneNumber: string,
  conversationRef: string,
  options?: { query?: string; limit?: number },
): Promise<{
  success: boolean;
  conversation?: AppChatConversationSummary;
  assets?: AppChatAssetSummary[];
  count?: number;
  error?: string;
}> {
  try {
    const { conversation } = await resolveConversationForUser(phoneNumber, conversationRef);
    let assets = await buildConversationAssets(conversation);

    const normalizedQuery = normalizeForMatch(options?.query || '');
    if (normalizedQuery) {
      assets = assets.filter(
        (asset) =>
          normalizeForMatch(asset.file_name).includes(normalizedQuery) ||
          normalizeForMatch(asset.asset_ref).includes(normalizedQuery),
      );
    }

    const limit = Math.min(Math.max(Number(options?.limit) || 20, 1), 50);
    const trimmed = assets.slice(0, limit).map(({ image_data, storage_path, external_file_id, message_id, ...asset }) => asset);

    return {
      success: true,
      conversation,
      assets: trimmed,
      count: trimmed.length,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'No pude listar los archivos de esa conversacion.',
    };
  }
}

async function writeImageDataToTempFile(fileName: string, imageData: string): Promise<string> {
  const tempDir = app.getPath('temp');
  const safeFileName = sanitizeFileName(fileName);
  const tempPath = path.join(tempDir, `soflia_app_chat_${Date.now()}_${safeFileName}`);

  if (imageData.startsWith('data:')) {
    const base64 = imageData.replace(/^data:[^;]+;base64,/i, '');
    await fsp.writeFile(tempPath, Buffer.from(base64, 'base64'));
    return tempPath;
  }

  if (path.isAbsolute(imageData) && fs.existsSync(imageData)) {
    return imageData;
  }

  throw new Error('Ese asset no tiene una imagen exportable disponible.');
}

export async function prepareAppChatAssetForDelivery(
  phoneNumber: string,
  conversationRef: string,
  assetRef: string,
  driveService: DriveService | null,
): Promise<{
  success: boolean;
  error?: string;
  prepared?: PreparedAppChatAsset;
  conversation?: AppChatConversationSummary;
}> {
  try {
    const { conversation } = await resolveConversationForUser(phoneNumber, conversationRef);
    const assets = await buildConversationAssets(conversation);
    const asset = resolveAssetByReference(assets, assetRef);

    if (!asset.sendable) {
      throw new Error(`El asset "${asset.file_name}" no tiene un archivo enviable disponible.`);
    }

    if (asset.kind === 'message_image') {
      const localPath = await writeImageDataToTempFile(asset.file_name, asset.image_data || '');
      return {
        success: true,
        conversation,
        prepared: {
          localPath,
          caption: `Archivo de la conversacion "${conversation.title}"`,
          cleanupAfterSend: localPath !== asset.image_data,
        },
      };
    }

    if (asset.storage_path && fs.existsSync(asset.storage_path)) {
      return {
        success: true,
        conversation,
        prepared: {
          localPath: asset.storage_path,
          caption: `Archivo de la conversacion "${conversation.title}"`,
          cleanupAfterSend: false,
        },
      };
    }

    if (asset.external_file_id) {
      if (!driveService) {
        throw new Error('No tengo Google Drive conectado para descargar ese archivo.');
      }

      const tempBase = path.join(app.getPath('temp'), `soflia_chat_asset_${Date.now()}_${sanitizeFileName(asset.file_name)}`);
      const download = await driveService.downloadFile(asset.external_file_id, tempBase, 'pdf');
      if (!download.success || !download.path) {
        throw new Error(download.error || 'No pude descargar el archivo de Drive asociado a esa conversacion.');
      }

      return {
        success: true,
        conversation,
        prepared: {
          localPath: download.path,
          caption: `Archivo de la conversacion "${conversation.title}"`,
          cleanupAfterSend: true,
        },
      };
    }

    throw new Error(`No pude materializar el archivo "${asset.file_name}".`);
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'No pude preparar ese archivo para enviarlo.',
    };
  }
}
