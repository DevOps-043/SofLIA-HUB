/**
 * Handlers para entrega de archivos/mensajes a través de WhatsApp.
 *
 * Cubre:
 *  - `whatsapp_send_file` — envía un archivo al chat actual
 *  - `whatsapp_send_to_contact` — envía a otro número (con normalización)
 *  - `save_whatsapp_file` — guarda un archivo recibido en una ruta del usuario
 *  - `open_file_on_computer` — abre un archivo con su app por defecto
 *  - `take_screenshot_and_send` — captura todos los monitores y los envía
 */

import { app, desktopCapturer, shell } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { buildResponse, errorResponse, type FunctionResponse, type ToolExecutorContext } from '../types';

const DELIVERY_TOOLS = new Set([
  'whatsapp_send_file',
  'save_whatsapp_file',
  'open_file_on_computer',
  'take_screenshot_and_send',
  'whatsapp_send_to_contact',
]);

const SCREENSHOT_CLEANUP_DELAY_MS = 5000;

export function isDeliveryTool(name: string): boolean {
  return DELIVERY_TOOLS.has(name);
}

/**
 * Normaliza un número de teléfono al formato JID de WhatsApp:
 * quita espacios, guiones, paréntesis y prefijo `+`.
 */
function normalizePhoneToJid(rawPhone: string): string {
  const clean = String(rawPhone || '').replace(/[\s\-+()]/g, '');
  return `${clean}@s.whatsapp.net`;
}

async function captureAndSendScreenshots(
  toolArgs: Record<string, any>,
  ctx: ToolExecutorContext,
  jid: string,
): Promise<{ sent: number; total: number }> {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 1920, height: 1080 },
  });
  if (sources.length === 0) {
    throw new Error('No se encontraron monitores');
  }

  const monitorIndex = toolArgs.monitor_index;
  const screensToCapture =
    monitorIndex !== undefined && monitorIndex !== null
      ? [sources[monitorIndex] || sources[0]]
      : sources;

  for (let i = 0; i < screensToCapture.length; i += 1) {
    const source = screensToCapture[i];
    const screenshotBase64 = source.thumbnail.toDataURL().replace(/^data:image\/png;base64,/, '');
    const tmpPath = path.join(app.getPath('temp'), `soflia_screenshot_${Date.now()}_monitor${i}.png`);
    await fs.writeFile(tmpPath, Buffer.from(screenshotBase64, 'base64'));
    const label =
      sources.length > 1
        ? `Monitor ${i + 1} de ${sources.length}: ${source.name}`
        : 'Captura de pantalla';
    await ctx.waService.sendFile(jid, tmpPath, label);
    setTimeout(() => fs.unlink(tmpPath).catch(() => {}), SCREENSHOT_CLEANUP_DELAY_MS);
  }

  return { sent: screensToCapture.length, total: sources.length };
}

export async function executeDeliveryTool(
  toolName: string,
  toolArgs: Record<string, any>,
  ctx: ToolExecutorContext,
  jid: string,
): Promise<FunctionResponse | null> {
  if (!DELIVERY_TOOLS.has(toolName)) {
    return null;
  }

  try {
    switch (toolName) {
      case 'whatsapp_send_file': {
        await ctx.waService.sendFile(jid, toolArgs.file_path, toolArgs.caption);
        return buildResponse(toolName, {
          success: true,
          message: `Archivo enviado por WhatsApp: ${toolArgs.file_path}`,
        });
      }

      case 'save_whatsapp_file': {
        const dest = toolArgs.destination_path;
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.copyFile(toolArgs.source_path, dest);
        return buildResponse(toolName, { success: true, message: `Archivo guardado en: ${dest}` });
      }

      case 'open_file_on_computer': {
        const errorMsg = await shell.openPath(toolArgs.file_path);
        if (errorMsg) {
          return errorResponse(toolName, errorMsg);
        }
        return buildResponse(toolName, {
          success: true,
          message: `Archivo abierto: ${path.basename(toolArgs.file_path)}`,
        });
      }

      case 'take_screenshot_and_send': {
        const { sent, total } = await captureAndSendScreenshots(toolArgs, ctx, jid);
        return buildResponse(toolName, {
          success: true,
          message: `${sent} captura(s) de pantalla enviada(s) por WhatsApp.`,
          monitors_total: total,
          sent,
        });
      }

      case 'whatsapp_send_to_contact': {
        const targetJid = normalizePhoneToJid(toolArgs.phone_number);

        if (toolArgs.file_path) {
          await ctx.waService.sendFile(targetJid, toolArgs.file_path, toolArgs.caption || toolArgs.message);
        }
        // Si hay mensaje SIN archivo, enviarlo solo. Si hay AMBOS, el mensaje
        // va separado después del archivo (Baileys no lo envía como caption).
        if (toolArgs.message && !toolArgs.file_path) {
          await ctx.waService.sendText(targetJid, toolArgs.message);
        } else if (toolArgs.message && toolArgs.file_path) {
          await ctx.waService.sendText(targetJid, toolArgs.message);
        }

        const fileLabel = toolArgs.file_path ? `archivo ${path.basename(toolArgs.file_path)}` : '';
        const messageLabel = toolArgs.message ? ' + mensaje' : '';
        return buildResponse(toolName, {
          success: true,
          message: `Enviado a ${toolArgs.phone_number}: ${fileLabel}${messageLabel}`,
        });
      }

      default:
        return null;
    }
  } catch (err: any) {
    return errorResponse(toolName, err.message);
  }
}
