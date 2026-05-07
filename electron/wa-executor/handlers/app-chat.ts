/**
 * Handlers para los tools `app_chat_*`.
 *
 * Permiten al agente WhatsApp leer/escribir conversaciones internas de la
 * app SofLIA Hub (no las del WhatsApp del usuario). Usado para que el agente
 * pueda traer contexto de un chat interno o exportar archivos desde uno.
 *
 * Cada handler delega a `app-chat-service` que maneja la persistencia y
 * los permisos. La autorización está acotada al `senderNumber` que llega
 * desde el message header — el agente no puede consultar conversaciones
 * de otros usuarios.
 */

import fs from 'node:fs/promises';
import {
  appendNoteToAppConversation,
  getAppChatConversationContext,
  listAppChatConversationAssets,
  listAppChatConversations,
  prepareAppChatAssetForDelivery,
} from '../../app-chat-service';
import { buildResponse, errorResponse, type FunctionResponse, type ToolExecutorContext } from '../types';

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
  return String(
    toolArgs.conversation_ref || toolArgs.conversation_id || toolArgs.conversation_name || '',
  ).trim();
}

export async function executeAppChatTool(
  toolName: string,
  toolArgs: Record<string, any>,
  ctx: ToolExecutorContext,
  jid: string,
  senderNumber: string,
): Promise<FunctionResponse | null> {
  if (!APP_CHAT_TOOLS.has(toolName)) {
    return null;
  }

  try {
    switch (toolName) {
      case 'app_chat_list_conversations': {
        const result = await listAppChatConversations(senderNumber, {
          query: typeof toolArgs.query === 'string' ? toolArgs.query : undefined,
          limit: toolArgs.limit,
        });
        return buildResponse(toolName, result);
      }

      case 'app_chat_get_context': {
        const conversationRef = extractConversationRef(toolArgs);
        const result = await getAppChatConversationContext(senderNumber, conversationRef, toolArgs.limit);
        return buildResponse(toolName, result);
      }

      case 'app_chat_append_note': {
        const conversationRef = extractConversationRef(toolArgs);
        const result = await appendNoteToAppConversation(
          senderNumber,
          conversationRef,
          String(toolArgs.content || ''),
        );
        return buildResponse(toolName, result);
      }

      case 'app_chat_list_assets': {
        const conversationRef = extractConversationRef(toolArgs);
        const result = await listAppChatConversationAssets(senderNumber, conversationRef, {
          query: typeof toolArgs.query === 'string' ? toolArgs.query : undefined,
          limit: toolArgs.limit,
        });
        return buildResponse(toolName, result);
      }

      case 'app_chat_send_asset': {
        const conversationRef = extractConversationRef(toolArgs);
        const assetRef = String(toolArgs.asset_ref || toolArgs.file_name || toolArgs.asset_id || '').trim();
        const prepared = await prepareAppChatAssetForDelivery(
          senderNumber,
          conversationRef,
          assetRef,
          ctx.driveService,
        );

        if (!prepared.success || !prepared.prepared) {
          return buildResponse(toolName, prepared);
        }

        await ctx.waService.sendFile(
          jid,
          prepared.prepared.localPath,
          toolArgs.caption || prepared.prepared.caption,
        );

        // Cleanup diferido: damos margen para que la entrega de WhatsApp termine.
        if (prepared.prepared.cleanupAfterSend) {
          setTimeout(() => {
            fs.unlink(prepared.prepared!.localPath).catch(() => {
              /* el archivo puede no existir si ya se limpió en otro lado */
            });
          }, 5000);
        }

        return buildResponse(toolName, {
          success: true,
          conversation: prepared.conversation,
          localPath: prepared.prepared.localPath,
          message: `Archivo enviado desde la conversacion "${prepared.conversation?.title || conversationRef}".`,
        });
      }

      default:
        return null;
    }
  } catch (err: any) {
    return errorResponse(toolName, err.message);
  }
}
