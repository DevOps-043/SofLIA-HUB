/**
 * OCRService — Extracts text from screenshots using tesseract.js.
 * Runs in the Electron main process. Worker is lazy-initialized and reused.
 */

let workerInstance: any = null;
let isInitializing = false;

async function getWorker(): Promise<any> {
  if (workerInstance) return workerInstance;
  if (isInitializing) {
    // Wait for initialization
    while (isInitializing) {
      await new Promise(r => setTimeout(r, 100));
    }
    return workerInstance;
  }

  isInitializing = true;
  try {
    const Tesseract = await import('tesseract.js');
    workerInstance = await Tesseract.createWorker('spa+eng', undefined, {
      // @ts-ignore - logger option exists but types may not include it
      logger: () => {}, // Suppress progress logs
    });
    // Declarar el DPI evita el warning "Invalid resolution 25 dpi" y mejora el
    // reconocimiento de fuentes de UI (que tesseract asume a baja resolucion).
    await workerInstance.setParameters({ user_defined_dpi: '96' });
    console.log('[OCRService] Worker initialized (spa+eng, 96dpi)');
    return workerInstance;
  } catch (err: any) {
    console.error('[OCRService] Failed to initialize:', err.message);
    throw err;
  } finally {
    isInitializing = false;
  }
}

/**
 * Extract text from an image file path.
 */
export async function extractTextFromFile(filePath: string): Promise<string> {
  try {
    const worker = await getWorker();
    const { data: { text } } = await worker.recognize(filePath);
    return text.trim();
  } catch (err: any) {
    console.error('[OCRService] OCR error:', err.message);
    return '';
  }
}

/**
 * Extract text from a base64 image string.
 */
export async function extractTextFromBase64(base64Data: string): Promise<string> {
  try {
    const worker = await getWorker();
    // Handle data URL or raw base64
    const imageData = base64Data.startsWith('data:') ? base64Data : `data:image/png;base64,${base64Data}`;
    const { data: { text } } = await worker.recognize(imageData);
    return text.trim();
  } catch (err: any) {
    console.error('[OCRService] OCR error:', err.message);
    return '';
  }
}

/** Texto reconocido con su caja delimitadora en pixeles de la imagen de entrada. */
export type OcrTextBox = {
  texto: string;
  /** Confianza 0-1 reportada por tesseract. */
  confianza: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
};

/**
 * Reconoce texto CON coordenadas (lineas y palabras) desde una imagen base64.
 * Base del proveedor OCR del element-locator: permite ubicar un texto visible
 * en cualquier aplicacion (Chromium, Java, juegos, terminales) leyendo los
 * pixeles, sin depender de arboles de accesibilidad.
 */
export async function extractTextBoxesFromBase64(
  base64Data: string,
): Promise<{ lineas: OcrTextBox[]; palabras: OcrTextBox[] }> {
  try {
    const worker = await getWorker();
    const imageData = base64Data.startsWith('data:') ? base64Data : `data:image/png;base64,${base64Data}`;
    const { data } = await worker.recognize(imageData);
    const toBox = (item: any): OcrTextBox => ({
      texto: String(item?.text || '').trim(),
      confianza: Math.max(0, Math.min(1, (item?.confidence ?? 0) / 100)),
      bbox: {
        x0: Number(item?.bbox?.x0 ?? 0),
        y0: Number(item?.bbox?.y0 ?? 0),
        x1: Number(item?.bbox?.x1 ?? 0),
        y1: Number(item?.bbox?.y1 ?? 0),
      },
    });
    return {
      lineas: (data?.lines || []).map(toBox).filter((box: OcrTextBox) => box.texto),
      palabras: (data?.words || []).map(toBox).filter((box: OcrTextBox) => box.texto),
    };
  } catch (err: any) {
    console.error('[OCRService] OCR con coordenadas fallo:', err.message);
    return { lineas: [], palabras: [] };
  }
}

/**
 * Terminate the worker to free resources.
 */
export async function terminateOCR(): Promise<void> {
  if (workerInstance) {
    try {
      await workerInstance.terminate();
    } catch { /* ignore */ }
    workerInstance = null;
    console.log('[OCRService] Worker terminated');
  }
}
