import { BLOCKED_TOOLS_WA, CONFIRM_TOOLS_WA, GROUP_BLOCKED_TOOLS } from '../whatsapp-tools';
import { buildConfirmationDescription } from './confirmations';
import { detectProtectedPathAccess } from './security';
import { errorResponse, type FunctionResponse, type ToolExecutorContext } from './types';

export async function evaluateToolGuards(
  toolName: string,
  toolArgs: Record<string, any>,
  ctx: ToolExecutorContext,
  jid: string,
  senderNumber: string,
  isGroup: boolean,
): Promise<FunctionResponse | null> {
  if (BLOCKED_TOOLS_WA.has(toolName)) {
    return errorResponse(toolName, 'Esta herramienta no esta disponible por WhatsApp por seguridad.');
  }

  if (isGroup && GROUP_BLOCKED_TOOLS.has(toolName)) {
    return errorResponse(toolName, 'Esta herramienta no esta permitida en grupos por seguridad.');
  }

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
