import {
  buildWhatsAppProfileUpdate,
  normalizeWhatsAppProfilePatch,
  resolveWhatsAppProfileTarget,
} from '../../whatsapp/profile-update';
import { DEFAULT_CONFIG } from '../../whatsapp/types';
import { buildResponse, errorResponse, type FunctionResponse, type ToolExecutorContext } from '../types';

export function isProfileTool(name: string): boolean {
  return name === 'whatsapp_update_profile';
}

export async function executeProfileTool(
  toolName: string,
  toolArgs: Record<string, any>,
  ctx: ToolExecutorContext,
  jid: string,
  senderNumber: string,
  isGroup: boolean,
): Promise<FunctionResponse> {
  if (!isProfileTool(toolName)) return errorResponse(toolName, 'Herramienta de perfil desconocida.');
  const target = resolveWhatsAppProfileTarget(ctx.waService.config, jid, senderNumber, isGroup);
  const reset = toolArgs.reset === true;
  const patch = reset ? null : normalizeWhatsAppProfilePatch(toolArgs);
  if (!reset && Object.keys(patch || {}).length === 0) {
    return errorResponse(toolName, 'No recibi campos validos para actualizar el perfil.');
  }

  const profilePatch = reset && target.type === 'global'
    ? DEFAULT_CONFIG.globalPersonalization
    : patch;
  await ctx.waService.setPersonalization(buildWhatsAppProfileUpdate(target, profilePatch));

  return buildResponse(toolName, {
    success: true,
    target: target.label,
    reset,
    updatedFields: reset ? ['reset'] : Object.keys(patch || {}),
    message: reset
      ? `Personalizacion reiniciada para ${target.label}.`
      : `Personalizacion guardada para ${target.label}.`,
  });
}
