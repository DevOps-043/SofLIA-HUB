import { shell } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { buildResponse, errorResponse, type FunctionResponse, type ToolExecutorContext } from '../types';
import { normalizePhoneToJid } from './delivery/phone';
import { captureAndSendScreenshots } from './delivery/screenshots';

const DELIVERY_TOOLS = new Set([
  'whatsapp_send_file',
  'save_whatsapp_file',
  'open_file_on_computer',
  'take_screenshot_and_send',
  'whatsapp_send_to_contact',
]);

export function isDeliveryTool(name: string): boolean {
  return DELIVERY_TOOLS.has(name);
}

export async function executeDeliveryTool(
  toolName: string,
  toolArgs: Record<string, any>,
  ctx: ToolExecutorContext,
  jid: string,
): Promise<FunctionResponse | null> {
  if (!DELIVERY_TOOLS.has(toolName)) return null;

  try {
    if (toolName === 'whatsapp_send_file') {
      await ctx.waService.sendFile(jid, toolArgs.file_path, toolArgs.caption);
      return buildResponse(toolName, { success: true, message: `Archivo enviado por WhatsApp: ${toolArgs.file_path}` });
    }
    if (toolName === 'save_whatsapp_file') {
      const dest = toolArgs.destination_path;
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.copyFile(toolArgs.source_path, dest);
      return buildResponse(toolName, { success: true, message: `Archivo guardado en: ${dest}` });
    }
    if (toolName === 'open_file_on_computer') {
      const errorMsg = await shell.openPath(toolArgs.file_path);
      return errorMsg
        ? errorResponse(toolName, errorMsg)
        : buildResponse(toolName, { success: true, message: `Archivo abierto: ${path.basename(toolArgs.file_path)}` });
    }
    if (toolName === 'take_screenshot_and_send') {
      const { sent, total } = await captureAndSendScreenshots(toolArgs, ctx, jid);
      return buildResponse(toolName, {
        success: true,
        message: `${sent} captura(s) de pantalla enviada(s) por WhatsApp.`,
        monitors_total: total,
        sent,
      });
    }
    if (toolName === 'whatsapp_send_to_contact') {
      return sendToContact(toolName, toolArgs, ctx);
    }

    return null;
  } catch (err: any) {
    return errorResponse(toolName, err.message);
  }
}

async function sendToContact(
  toolName: string,
  toolArgs: Record<string, any>,
  ctx: ToolExecutorContext,
): Promise<FunctionResponse> {
  const targetJid = normalizePhoneToJid(toolArgs.phone_number);

  if (toolArgs.file_path) {
    await ctx.waService.sendFile(targetJid, toolArgs.file_path, toolArgs.caption || toolArgs.message);
  }
  if (toolArgs.message) {
    await ctx.waService.sendText(targetJid, toolArgs.message);
  }

  const fileLabel = toolArgs.file_path ? `archivo ${path.basename(toolArgs.file_path)}` : '';
  const messageLabel = toolArgs.message ? ' + mensaje' : '';
  return buildResponse(toolName, {
    success: true,
    message: `Enviado a ${toolArgs.phone_number}: ${fileLabel}${messageLabel}`,
  });
}
