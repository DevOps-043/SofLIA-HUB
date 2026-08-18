import { shell } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { buildResponse, errorResponse, type FunctionResponse, type ToolExecutorContext } from '../types';
import { normalizePhoneToJid } from './delivery/phone';
import { captureAndSendScreenshots } from './delivery/screenshots';
import { readVoiceCallConfig } from '../../voice-call/config';
import { voiceCallSessions } from '../../voice-call/session-store';
import { synthesizeVoiceNote } from '../../voice-call/speech';
import { whatsAppVoiceSessionId } from '../../wa-agent/voice-delivery';

const DELIVERY_TOOLS = new Set([
  'whatsapp_send_file',
  'save_whatsapp_file',
  'open_file_on_computer',
  'take_screenshot_and_send',
  'whatsapp_send_to_contact',
  'send_voice_note',
]);

export function isDeliveryTool(name: string): boolean {
  return DELIVERY_TOOLS.has(name);
}

export async function executeDeliveryTool(
  toolName: string,
  toolArgs: Record<string, any>,
  ctx: ToolExecutorContext,
  jid: string,
  senderNumber = '',
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
    if (toolName === 'send_voice_note') {
      return sendVoiceNote(toolName, toolArgs, ctx, jid, senderNumber);
    }

    return null;
  } catch (err: any) {
    return errorResponse(toolName, err.message);
  }
}

/**
 * Habla dentro del turno, sin esperar a la respuesta final.
 *
 * Abre el modo llamada al hacerlo: si el agente decidio hablar, lo natural es
 * que la conversacion siga hablada hasta que el usuario cuelgue. El fallo se
 * devuelve al modelo como resultado, no como excepcion, para que pueda seguir
 * por escrito en el mismo turno.
 */
async function sendVoiceNote(
  toolName: string,
  toolArgs: Record<string, any>,
  ctx: ToolExecutorContext,
  jid: string,
  senderNumber: string,
): Promise<FunctionResponse> {
  const text = String(toolArgs.text ?? '').trim();
  if (!text) return errorResponse(toolName, 'No hay texto que decir.');
  if (!readVoiceCallConfig().enabled) {
    return errorResponse(toolName, 'El modo de voz esta desactivado en esta instalacion. Responde por escrito.');
  }

  try {
    const note = await synthesizeVoiceNote(text);
    await ctx.waService.sendVoiceNote(jid, note.buffer, note.seconds);
    const sessionId = whatsAppVoiceSessionId(jid, senderNumber);
    voiceCallSessions.open('whatsapp', sessionId, 'agent');
    voiceCallSessions.recordSpokenTurn('whatsapp', sessionId);
    return buildResponse(toolName, {
      success: true,
      message: 'Nota de voz enviada al usuario.',
      spoken_chars: note.spokenText.length,
      not_spoken: note.remainderText || undefined,
    });
  } catch (error: any) {
    return errorResponse(toolName, `No pude generar la nota de voz: ${error.message}. Responde por escrito.`);
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
