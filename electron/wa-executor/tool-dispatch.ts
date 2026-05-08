import { executeToolDirect } from '../computer-use-handlers';
import { executeGoogleTool, isGoogleTool } from '../whatsapp-executors/google-executors';
import { executeIrisTool, isIrisTool } from '../whatsapp-executors/iris-executors';
import { executeSystemTool, isSystemTool } from '../whatsapp-executors/system-executors';
import { executeAppChatTool, isAppChatTool } from './handlers/app-chat';
import { handleCreateDocument } from './handlers/create-document';
import {
  executeDynamicTool,
  executeDynamicToolsetTool,
  isDynamicToolsetTool,
} from './handlers/dynamic-toolsets';
import { executeDeliveryTool, isDeliveryTool } from './handlers/delivery';
import { executeMemoryTool, isMemoryTool } from './handlers/memory';
import { executeMiscTool, isMiscTool } from './handlers/misc';
import { executeRemoteNodeTool, isRemoteNodeTool } from './handlers/remote-nodes';
import { executeUseComputerTool } from './handlers/use-computer';
import type { FunctionResponse, ToolExecutorContext } from './types';

type DispatchResult = {
  response: FunctionResponse;
  bulkLabelsToVerify: Set<string> | null;
};

export async function dispatchTool(
  toolName: string,
  toolArgs: Record<string, any>,
  ctx: ToolExecutorContext,
  jid: string,
  senderNumber: string,
  isGroup: boolean,
  bulkLabelsToVerify: Set<string> | null,
): Promise<DispatchResult> {
  const delegated = await tryDelegatedTool(toolName, toolArgs, ctx, jid, senderNumber, bulkLabelsToVerify);
  if (delegated) return delegated;

  const dynamicResult = await executeDynamicTool(toolName, toolArgs, isGroup);
  if (dynamicResult) return { response: dynamicResult, bulkLabelsToVerify };

  const specialized = await trySpecializedTool(toolName, toolArgs, ctx, jid, senderNumber);
  if (specialized) return { response: specialized, bulkLabelsToVerify };

  return executeFallbackTool(toolName, toolArgs, bulkLabelsToVerify);
}

async function tryDelegatedTool(
  toolName: string,
  toolArgs: Record<string, any>,
  ctx: ToolExecutorContext,
  jid: string,
  senderNumber: string,
  bulkLabelsToVerify: Set<string> | null,
): Promise<DispatchResult | null> {
  if (isGoogleTool(toolName)) {
    const result = await executeGoogleTool(toolName, toolArgs, ctx, bulkLabelsToVerify);
    if (result) return result;
  }
  if (isIrisTool(toolName)) {
    const response = await executeIrisTool(toolName, toolArgs, senderNumber);
    if (response) return { response, bulkLabelsToVerify };
  }
  if (isSystemTool(toolName)) {
    const response = await executeSystemTool(toolName, toolArgs);
    if (response) return { response, bulkLabelsToVerify };
  }
  if (isAppChatTool(toolName)) {
    const response = await executeAppChatTool(toolName, toolArgs, ctx, jid, senderNumber);
    if (response) return { response, bulkLabelsToVerify };
  }
  if (isDynamicToolsetTool(toolName)) {
    const response = await executeDynamicToolsetTool(toolName, toolArgs);
    if (response) return { response, bulkLabelsToVerify };
  }
  return null;
}

async function trySpecializedTool(
  toolName: string,
  toolArgs: Record<string, any>,
  ctx: ToolExecutorContext,
  jid: string,
  senderNumber: string,
): Promise<FunctionResponse | null> {
  if (isDeliveryTool(toolName)) return executeDeliveryTool(toolName, toolArgs, ctx, jid);
  if (isMiscTool(toolName)) return executeMiscTool(toolName, toolArgs, ctx, senderNumber);
  if (isRemoteNodeTool(toolName)) return executeRemoteNodeTool(toolName, toolArgs);
  if (toolName === 'use_computer') return executeUseComputerTool(toolName, toolArgs, ctx, jid);
  if (isMemoryTool(toolName)) return executeMemoryTool(toolName, toolArgs, ctx, senderNumber);
  if (toolName === 'create_document') return handleCreateDocument(toolArgs, ctx);
  return null;
}

async function executeFallbackTool(
  toolName: string,
  toolArgs: Record<string, any>,
  bulkLabelsToVerify: Set<string> | null,
): Promise<DispatchResult> {
  try {
    const response = await executeToolDirect(toolName, toolArgs);
    return { response: { functionResponse: { name: toolName, response } }, bulkLabelsToVerify };
  } catch (err: any) {
    return {
      response: { functionResponse: { name: toolName, response: { success: false, error: err.message } } },
      bulkLabelsToVerify,
    };
  }
}
