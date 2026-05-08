import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { DriveService } from '../drive-service';
import { buildConversationAssets } from './assets-builder';
import { resolveAssetByReference } from './assets-reference';
import { writeImageDataToTempFile } from './assets-temp-files';
import { resolveConversationForUser } from './conversation-reference';
import { sanitizeFileName } from './text-utils';
import type { AppChatConversationSummary, InternalAssetRecord, PreparedAppChatAsset } from './types';

function buildPreparedAsset(localPath: string, conversation: AppChatConversationSummary, cleanupAfterSend: boolean) {
  return {
    localPath,
    caption: `Archivo de la conversacion "${conversation.title}"`,
    cleanupAfterSend,
  };
}

async function prepareWorkspaceSourceAsset(
  asset: InternalAssetRecord,
  conversation: AppChatConversationSummary,
  driveService: DriveService | null,
): Promise<PreparedAppChatAsset> {
  if (asset.storage_path && fs.existsSync(asset.storage_path)) {
    return buildPreparedAsset(asset.storage_path, conversation, false);
  }
  if (!asset.external_file_id) {
    throw new Error(`No pude materializar el archivo "${asset.file_name}".`);
  }
  if (!driveService) {
    throw new Error('No tengo Google Drive conectado para descargar ese archivo.');
  }

  const tempBase = path.join(app.getPath('temp'), `soflia_chat_asset_${Date.now()}_${sanitizeFileName(asset.file_name)}`);
  const download = await driveService.downloadFile(asset.external_file_id, tempBase, 'pdf');
  if (!download.success || !download.path) {
    throw new Error(download.error || 'No pude descargar el archivo de Drive asociado a esa conversacion.');
  }
  return buildPreparedAsset(download.path, conversation, true);
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
    const asset = resolveAssetByReference(await buildConversationAssets(conversation), assetRef);
    if (!asset.sendable) {
      throw new Error(`El asset "${asset.file_name}" no tiene un archivo enviable disponible.`);
    }

    const prepared = asset.kind === 'message_image'
      ? buildPreparedAsset(
        await writeImageDataToTempFile(asset.file_name, asset.image_data || ''),
        conversation,
        true,
      )
      : await prepareWorkspaceSourceAsset(asset, conversation, driveService);
    return { success: true, conversation, prepared };
  } catch (error: any) {
    return { success: false, error: error?.message || 'No pude preparar ese archivo para enviarlo.' };
  }
}
