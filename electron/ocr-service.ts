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
    console.log('[OCRService] Worker initialized (spa+eng)');
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
