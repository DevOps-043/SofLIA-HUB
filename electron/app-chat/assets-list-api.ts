import { buildConversationAssets } from './assets-builder';
import { resolveConversationForUser } from './conversation-reference';
import { normalizeForMatch } from './text-utils';
import type { AppChatAssetSummary, AppChatConversationSummary } from './types';

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
    return { success: true, conversation, assets: trimmed, count: trimmed.length };
  } catch (error: any) {
    return { success: false, error: error?.message || 'No pude listar los archivos de esa conversacion.' };
  }
}
