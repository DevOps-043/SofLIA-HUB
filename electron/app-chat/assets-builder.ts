import fs from 'node:fs';
import path from 'node:path';
import { getLiaClient } from './clients';
import { buildImageAssetFileName } from './text-utils';
import type { AppChatConversationSummary, InternalAssetRecord } from './types';

function mapWorkspaceSource(source: any): InternalAssetRecord {
  const storagePath = source.storage_path ? String(source.storage_path).trim() : null;
  const externalUrl = source.external_url ? String(source.external_url).trim() : null;
  const externalFileId = source.external_file_id ? String(source.external_file_id).trim() : null;
  return {
    asset_ref: `source:${source.id}`,
    file_name: source.file_name,
    created_at: source.created_at,
    kind: 'workspace_source',
    sendable: Boolean((storagePath && fs.existsSync(storagePath)) || externalFileId),
    source_type: source.source_type ?? null,
    mime_type: source.mime_type ?? null,
    file_size: typeof source.file_size === 'number' ? source.file_size : Number(source.file_size || 0) || null,
    external_url: externalUrl,
    storage_path: storagePath,
    external_file_id: externalFileId,
  };
}

function collectMessageImages(conversation: AppChatConversationSummary, messages: any[]): InternalAssetRecord[] {
  const assets: InternalAssetRecord[] = [];
  for (const message of messages) {
    const images = Array.isArray(message.metadata?.images) ? message.metadata.images : [];
    images.forEach((image: string, index: number) => {
      const rawImage = String(image || '').trim();
      if (!rawImage) return;
      const mimeType = rawImage.match(/^data:([^;]+);base64,/i)?.[1] || null;
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
  return assets;
}

export async function buildConversationAssets(
  conversation: AppChatConversationSummary,
): Promise<InternalAssetRecord[]> {
  const lia = getLiaClient();
  if (!lia) throw new Error('Lia no esta configurado en este dispositivo.');

  const [sourcesResult, messagesResult] = await Promise.all([
    lia.from('workspace_sources')
      .select('id, source_type, file_name, file_size, mime_type, external_file_id, external_url, storage_path, created_at')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: false })
      .limit(50),
    lia.from('messages')
      .select('id, metadata, created_at')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: false })
      .limit(80),
  ]);

  if (sourcesResult.error) throw new Error(sourcesResult.error.message);
  if (messagesResult.error) throw new Error(messagesResult.error.message);

  const sourceAssets = (sourcesResult.data || []).map(mapWorkspaceSource);
  const imageAssets = collectMessageImages(conversation, messagesResult.data || []);
  return [...sourceAssets, ...imageAssets].sort(
    (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
  );
}
