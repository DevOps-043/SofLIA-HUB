/**
 * OCRService — Extracts text from screenshots using tesseract.js.
 * Migrated to UtilityProcess to free Main Process CPU.
 * Worker is lazy-initialized and reused.
 */

import { utilityProcess, MessageChannelMain } from 'electron';
import * as path from 'path';

let workerProcess: any = null;
let messagePort: any = null;
let isInitializing = false;
let messageIdCounter = 0;
const pendingRequests = new Map<number, { resolve: (val: string) => void; reject: (err: any) => void }>();

async function getWorkerPort(): Promise<any> {
  if (workerProcess && messagePort) return messagePort;
  if (isInitializing) {
    // Wait for initialization
    while (isInitializing) {
      await new Promise(r => setTimeout(r, 100));
    }
    return messagePort;
  }

  isInitializing = true;
  try {
    workerProcess = utilityProcess.fork(path.join(__dirname, 'ocr-worker.js'));
    
    workerProcess.on('exit', () => {
      console.log('[OCRService] UtilityProcess exited');
      workerProcess = null;
      if (messagePort) {
        messagePort.close();
        messagePort = null;
      }
      for (const { reject } of pendingRequests.values()) {
        reject(new Error('Worker exited unexpectedly'));
      }
      pendingRequests.clear();
    });

    const { port1, port2 } = new MessageChannelMain();
    
    // Pass port1 to the child process for IPC
    workerProcess.postMessage({ type: 'init' }, [port1]);
    
    messagePort = port2;
    messagePort.on('message', (event: any) => {
      const { id, text, error } = event.data;
      if (pendingRequests.has(id)) {
        const { resolve, reject } = pendingRequests.get(id)!;
        if (error) {
          reject(new Error(error));
        } else {
          resolve(text);
        }
        pendingRequests.delete(id);
      }
    });
    messagePort.start();

    console.log('[OCRService] UtilityProcess Worker initialized');
    return messagePort;
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
    const port = await getWorkerPort();
    const id = messageIdCounter++;
    
    const text = await new Promise<string>((resolve, reject) => {
      pendingRequests.set(id, { resolve, reject });
      port.postMessage({ id, action: 'recognize', payload: filePath });
    });
    return text ? text.trim() : '';
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
    const port = await getWorkerPort();
    const id = messageIdCounter++;
    
    // Handle data URL or raw base64
    const imageData = base64Data.startsWith('data:') ? base64Data : `data:image/png;base64,${base64Data}`;
    
    const text = await new Promise<string>((resolve, reject) => {
      pendingRequests.set(id, { resolve, reject });
      port.postMessage({ id, action: 'recognize', payload: imageData });
    });
    return text ? text.trim() : '';
  } catch (err: any) {
    console.error('[OCRService] OCR error:', err.message);
    return '';
  }
}

/**
 * Terminate the worker to free resources.
 */
export async function terminateOCR(): Promise<void> {
  if (workerProcess) {
    try {
      workerProcess.kill();
    } catch { /* ignore */ }
    workerProcess = null;
  }
  
  if (messagePort) {
    messagePort.close();
    messagePort = null;
  }
  
  for (const { reject } of pendingRequests.values()) {
    reject(new Error('Worker terminated'));
  }
  pendingRequests.clear();
  
  console.log('[OCRService] Worker terminated');
}
