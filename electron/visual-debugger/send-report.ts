import fs from 'node:fs/promises';
import type { WhatsAppService } from '../whatsapp-service';

interface SendVisualDebugReportInput {
  errorMessage: string;
  fileName: string;
  tempFilePath: string;
  waService?: WhatsAppService;
  phoneNumber?: string;
}

export async function sendVisualDebugReport({
  errorMessage,
  fileName,
  tempFilePath,
  waService,
  phoneNumber,
}: SendVisualDebugReportInput): Promise<boolean> {
  if (!waService || !phoneNumber || !waService.getStatus().connected) {
    console.warn('[VisualDebugger] WhatsApp no provisto o no esta conectado. Imagen guardada pero no enviada.');
    return false;
  }

  const cleanNumber = phoneNumber.replace(/\D/g, '');
  const jid = `${cleanNumber}@s.whatsapp.net`;
  const caption = `*SofLIA Visual Debugger*\n\n*Error:* ${errorMessage}\n\nError visual en la zona marcada. Intento otra ruta?`;
  await waService.sendFile(jid, tempFilePath, caption);
  console.log(`[VisualDebugger] Alerta interactiva enviada con exito a ${jid}`);
  setTimeout(() => {
    fs.unlink(tempFilePath).catch((err) =>
      console.error(`[VisualDebugger] No se pudo borrar el temporal ${fileName}:`, err.message),
    );
  }, 15000);
  return true;
}
