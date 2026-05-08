import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { WhatsAppService } from './whatsapp-service';
import { capturePrimaryScreen } from './visual-debugger/capture';
import { buildFailureOverlay } from './visual-debugger/overlay';
import { sendVisualDebugReport } from './visual-debugger/send-report';
import { getSharp } from './visual-debugger/sharp-loader';

export class VisualDebuggerService {
  public static async handleVisualError(
    errorMessage: string,
    x: number,
    y: number,
    waService?: WhatsAppService,
    phoneNumber?: string,
  ): Promise<boolean> {
    try {
      console.log(`[VisualDebugger] Generando reporte visual de error en coordenadas (${x}, ${y})`);
      const capture = await capturePrimaryScreen();
      const overlay = buildFailureOverlay(capture, x, y);
      const finalImageBuffer = await getSharp()(capture.screenshotBuffer)
        .composite([{ input: overlay, top: 0, left: 0 }])
        .png()
        .toBuffer();

      const fileName = `visual_debugger_${Date.now()}.png`;
      const tempFilePath = path.join(app.getPath('temp'), fileName);
      await fs.writeFile(tempFilePath, finalImageBuffer);
      console.log(`[VisualDebugger] Mascara generada y guardada en: ${tempFilePath}`);

      return sendVisualDebugReport({
        errorMessage,
        fileName,
        tempFilePath,
        waService,
        phoneNumber,
      });
    } catch (error: any) {
      console.error('[VisualDebugger] Fallo critico al manejar el error visual:', error.message);
      return false;
    }
  }
}
