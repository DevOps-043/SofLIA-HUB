import { app, desktopCapturer, screen } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import type { WhatsAppService } from './whatsapp-service';

// sharp: native module loaded via require() to avoid ESM↔CJS interop crash
let sharp: any = null;
try {
  const _require = createRequire(import.meta.url);
  sharp = _require('sharp');
} catch (err: any) {
  console.warn('[VisualDebugger] sharp not available:', err.message);
}

/**
 * Servicio interactivo de Depuración Visual.
 * Permite a SofLIA reportar visualmente al usuario cuando falla al encontrar
 * elementos en la pantalla, marcando la zona donde ocurrió el error y enviando
 * una captura por WhatsApp para solicitar intervención o confirmar otra ruta.
 */
export class VisualDebuggerService {
  /**
   * Genera una captura de pantalla, marca la zona de error con un recuadro rojo,
   * y la envía al usuario por WhatsApp pidiendo intervención.
   * 
   * @param errorMessage Descripción del error o contexto
   * @param x Coordenada X donde ocurrió el fallo
   * @param y Coordenada Y donde ocurrió el fallo
   * @param waService Instancia activa de WhatsAppService para enviar el mensaje (Opcional)
   * @param phoneNumber Número del usuario administrador a notificar (Opcional)
   * @returns boolean indicando si se envió exitosamente la alerta
   */
  public static async handleVisualError(
    errorMessage: string,
    x: number,
    y: number,
    waService?: WhatsAppService,
    phoneNumber?: string
  ): Promise<boolean> {
    try {
      console.log(`[VisualDebugger] Generando reporte visual de error en coordenadas (${x}, ${y})`);

      // 1. Obtener resolución real de la pantalla principal para la captura
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width: screenWidth, height: screenHeight } = primaryDisplay.size;
      const scaleFactor = primaryDisplay.scaleFactor;

      const captureWidth = Math.floor(screenWidth * scaleFactor);
      const captureHeight = Math.floor(screenHeight * scaleFactor);

      // 2. Tomar captura de pantalla segura con desktopCapturer
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: captureWidth, height: captureHeight }
      });

      if (!sources || sources.length === 0) {
        throw new Error('No se encontraron fuentes de pantalla disponibles para capturar.');
      }

      // Usar la pantalla principal (generalmente la primera)
      const source = sources[0];
      const screenshotBuffer = source.thumbnail.toPNG();

      // 3. Obtener dimensiones exactas de la imagen capturada para el SVG
      const metadata = await sharp(screenshotBuffer).metadata();
      const imgWidth = metadata.width || captureWidth;
      const imgHeight = metadata.height || captureHeight;

      // Escalar las coordenadas proporcionadas si la escala de captura es diferente
      // Si las coordenadas x,y son relativas a la pantalla lógica, las multiplicamos por el scaleFactor.
      const scaledX = Math.round(x * scaleFactor);
      const scaledY = Math.round(y * scaleFactor);

      // Asegurar que las coordenadas estén dentro del lienzo
      const safeX = Math.max(0, Math.min(scaledX, imgWidth));
      const safeY = Math.max(0, Math.min(scaledY, imgHeight));

      // 4. Crear máscara SVG interactiva (un recuadro rojo y un punto de mira)
      const rectSize = 80; // Tamaño del recuadro de enfoque
      const halfSize = rectSize / 2;
      
      const svgOverlay = Buffer.from(`
        <svg width="${imgWidth}" height="${imgHeight}" xmlns="http://www.w3.org/2000/svg">
          <!-- Sombra/Fondo oscuro tenue para resaltar el error -->
          <rect x="0" y="0" width="${imgWidth}" height="${imgHeight}" fill="rgba(0,0,0,0.15)" />
          
          <!-- Recuadro rojo marcando el área -->
          <rect x="${safeX - halfSize}" y="${safeY - halfSize}" width="${rectSize}" height="${rectSize}" 
                fill="none" stroke="#FF0000" stroke-width="6" stroke-dasharray="10,5" />
          
          <!-- Punto central exacto -->
          <circle cx="${safeX}" cy="${safeY}" r="6" fill="#FF0000" />
          
          <!-- Etiqueta de texto de advertencia -->
          <text x="${safeX + halfSize + 15}" y="${safeY + 8}" 
                fill="#FF0000" font-size="28" font-family="sans-serif" font-weight="bold" 
                stroke="#FFFFFF" stroke-width="2" paint-order="stroke">
            Zona de Fallo
          </text>
        </svg>
      `);

      // 5. Componer la imagen final uniendo la captura con el SVG usando Sharp
      const finalImageBuffer = await sharp(screenshotBuffer)
        .composite([{ input: svgOverlay, top: 0, left: 0 }])
        .png()
        .toBuffer();

      // 6. Guardar temporalmente la imagen procesada
      const tempDir = app.getPath('temp');
      const fileName = `visual_debugger_${Date.now()}.png`;
      const tempFilePath = path.join(tempDir, fileName);
      await fs.writeFile(tempFilePath, finalImageBuffer);

      console.log(`[VisualDebugger] Máscara generada y guardada en: ${tempFilePath}`);

      // 7. Enviar la evidencia por WhatsApp al usuario si se proveyeron dependencias
      if (waService && phoneNumber && waService.getStatus().connected) {
        // Limpiar el número y asegurar el formato JID correcto
        const cleanNumber = phoneNumber.replace(/\D/g, '');
        const jid = `${cleanNumber}@s.whatsapp.net`;
        
        const caption = `🚨 *SofLIA Visual Debugger*\n\n*Error:* ${errorMessage}\n\nError visual en la zona marcada. ¿Intento otra ruta?`;
        
        await waService.sendFile(jid, tempFilePath, caption);
        console.log(`[VisualDebugger] Alerta interactiva enviada con éxito a ${jid}`);
        
        // Limpiar el archivo temporal de forma asíncrona luego de 15 segundos para asegurar el envío
        setTimeout(() => {
          fs.unlink(tempFilePath).catch(err => 
            console.error(`[VisualDebugger] No se pudo borrar el temporal ${fileName}:`, err.message)
          );
        }, 15000);
        
        return true;
      } else {
        console.warn('[VisualDebugger] WhatsApp no provisto o no está conectado. Imagen guardada pero no enviada.');
        // No borramos la imagen aquí para que el desarrollador pueda inspeccionarla localmente
        return false;
      }
    } catch (error: any) {
      console.error('[VisualDebugger] Fallo crítico al manejar el error visual:', error.message);
      return false;
    }
  }
}
