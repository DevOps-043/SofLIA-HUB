import { BLOCKED_TOOLS_WA, CONFIRM_TOOLS_WA, GROUP_BLOCKED_TOOLS } from '../whatsapp-tools';
import { getWhatsAppToolAccessError } from '../whatsapp/access-control';
import { buildConfirmationDescription } from './confirmations';
import { detectProtectedPathAccess } from './security';
import { errorResponse, type FunctionResponse, type ToolExecutorContext } from './types';

export async function evaluateToolGuards(
  toolName: string,
  toolArgs: Record<string, unknown>,
  ctx: ToolExecutorContext,
  jid: string,
  senderNumber: string,
  isGroup: boolean,
): Promise<FunctionResponse | null> {
  if (BLOCKED_TOOLS_WA.has(toolName)) {
    return errorResponse(toolName, 'Esta herramienta no esta disponible por WhatsApp por seguridad.');
  }

  if (ctx.communicationHub) {
    const hubAccess = await ctx.communicationHub.authorizeTool({
      provider: 'whatsapp',
      senderNumber,
      channelId: jid,
      toolName,
      isGroup,
      targetNodeId: typeof toolArgs.node_id === 'string' ? toolArgs.node_id : null,
    });
    if (!hubAccess.allowed) {
      return errorResponse(toolName, hubAccess.reason || 'No tienes permisos para ejecutar esta herramienta desde este canal.');
    }
    if (hubAccess.principal.source !== 'legacy') {
      return await evaluateProtectedPathAndConfirmation(toolName, toolArgs, ctx, jid, senderNumber);
    }
  }

  const accessError = getWhatsAppToolAccessError(ctx.waService.config, senderNumber, toolName, {
    isGroup,
    isGroupBlocked: isGroup && GROUP_BLOCKED_TOOLS.has(toolName),
  });
  if (accessError) {
    return errorResponse(toolName, accessError);
  }

  return await evaluateProtectedPathAndConfirmation(toolName, toolArgs, ctx, jid, senderNumber);
}

async function evaluateProtectedPathAndConfirmation(
  toolName: string,
  toolArgs: Record<string, unknown>,
  ctx: ToolExecutorContext,
  jid: string,
  senderNumber: string,
): Promise<FunctionResponse | null> {
  const protectedPathError = detectProtectedPathAccess(toolName, toolArgs);
  if (protectedPathError) {
    return errorResponse(toolName, protectedPathError);
  }

  if (!CONFIRM_TOOLS_WA.has(toolName) || ctx.skipConfirmations) {
    return null;
  }

  const description = buildConfirmationDescription(toolName, toolArgs);
  const confirmed = await ctx.requestConfirmation(jid, senderNumber, toolName, description, toolArgs);

  return confirmed ? null : errorResponse(toolName, 'Accion cancelada por el usuario.');
}
