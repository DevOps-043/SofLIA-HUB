import {
  appendNoteToAppConversation,
  getAppChatConversationContext,
  listAppChatConversationAssets,
  listAppChatConversations,
} from '../../app-chat-service';
import { buildResponse, errorResponse, type FunctionResponse, type ToolExecutorContext } from '../types';
import { sendAppChatAsset } from './app-chat/send-asset';

const APP_CHAT_TOOLS = new Set([
  'app_chat_list_conversations',
  'app_chat_get_context',
  'app_chat_append_note',
  'app_chat_list_assets',
  'app_chat_send_asset',
]);

export function isAppChatTool(name: string): boolean {
  return APP_CHAT_TOOLS.has(name);
}

function extractConversationRef(toolArgs: Record<string, any>): string {
  return String(toolArgs.conversation_ref || toolArgs.conversation_id || toolArgs.conversation_name || '').trim();
}

export async function executeAppChatTool(
  toolName: string,
  toolArgs: Record<string, any>,
  ctx: ToolExecutorContext,
  jid: string,
  senderNumber: string,
): Promise<FunctionResponse | null> {
  if (!APP_CHAT_TOOLS.has(toolName)) return null;

  try {
    const conversationRef = extractConversationRef(toolArgs);
    if (toolName === 'app_chat_list_conversations') {
      const result = await listAppChatConversations(senderNumber, {
        query: typeof toolArgs.query === 'string' ? toolArgs.query : undefined,
        limit: toolArgs.limit,
      });
      return buildResponse(toolName, result);
    }
    if (toolName === 'app_chat_get_context') {
      const result = await getAppChatConversationContext(senderNumber, conversationRef, toolArgs.limit);
      return buildResponse(toolName, result);
    }
    if (toolName === 'app_chat_append_note') {
      const result = await appendNoteToAppConversation(senderNumber, conversationRef, String(toolArgs.content || ''));
      return buildResponse(toolName, result);
    }
    if (toolName === 'app_chat_list_assets') {
      const result = await listAppChatConversationAssets(senderNumber, conversationRef, {
        query: typeof toolArgs.query === 'string' ? toolArgs.query : undefined,
        limit: toolArgs.limit,
      });
      return buildResponse(toolName, result);
    }
    if (toolName === 'app_chat_send_asset') {
      return sendAppChatAsset(toolName, toolArgs, ctx, jid, senderNumber, conversationRef);
    }
    return null;
  } catch (err: any) {
    return errorResponse(toolName, err.message);
  }
}
