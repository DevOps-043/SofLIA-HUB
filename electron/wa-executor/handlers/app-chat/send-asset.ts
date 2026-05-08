import fs from 'node:fs/promises';
import { prepareAppChatAssetForDelivery } from '../../../app-chat-service';
import { buildResponse, type FunctionResponse, type ToolExecutorContext } from '../../types';

export async function sendAppChatAsset(
  toolName: string,
  toolArgs: Record<string, any>,
  ctx: ToolExecutorContext,
  jid: string,
  senderNumber: string,
  conversationRef: string,
): Promise<FunctionResponse> {
  const assetRef = String(toolArgs.asset_ref || toolArgs.file_name || toolArgs.asset_id || '').trim();
  const prepared = await prepareAppChatAssetForDelivery(senderNumber, conversationRef, assetRef, ctx.driveService);
  if (!prepared.success || !prepared.prepared) return buildResponse(toolName, prepared);

  await ctx.waService.sendFile(jid, prepared.prepared.localPath, toolArgs.caption || prepared.prepared.caption);
  if (prepared.prepared.cleanupAfterSend) scheduleAssetCleanup(prepared.prepared.localPath);

  return buildResponse(toolName, {
    success: true,
    conversation: prepared.conversation,
    localPath: prepared.prepared.localPath,
    message: `Archivo enviado desde la conversacion "${prepared.conversation?.title || conversationRef}".`,
  });
}

function scheduleAssetCleanup(localPath: string): void {
  setTimeout(() => {
    fs.unlink(localPath).catch(() => {});
  }, 5000);
}
