import { createRequire } from 'node:module';
import type { Worker } from 'tesseract.js';
import { Worker as NativeWorker } from 'node:worker_threads';
import { assertGuiExecution, GuiFailure, type ComputerExecutionGuard } from './gui/execution-context';
import { selectOcrTarget } from './gui/ocr-elements';
const tesseract = createRequire(import.meta.url)('tesseract.js') as Pick<typeof import('tesseract.js'), 'createWorker'>;

async function closeWorker(worker: Worker): Promise<void> {
  try {
    // Tesseract 7 resuelve terminate antes del exit nativo; esperar ambos.
    const native = (worker as Worker & { worker?: unknown }).worker;
    const thread = native instanceof NativeWorker ? native : undefined;
    const exited = thread && thread.threadId !== -1 ? new Promise<void>(resolve => thread.once('exit', () => resolve())) : Promise.resolve();
    try { await worker.terminate(); }
    catch { if (thread) await thread.terminate(); else throw new GuiFailure('GUI_FAILED'); }
    await exited;
  } catch { throw new GuiFailure('GUI_FAILED'); }
}

export async function findTextCoordinates(textToFind: string, imageBuffer: Buffer, guard?: ComputerExecutionGuard): Promise<{ x: number; y: number; confidence: number }> {
  if (!textToFind.trim() || textToFind.length > 20000 || imageBuffer.length > 32 * 1024 * 1024) throw new GuiFailure('GUI_INVALID_INPUT');
  let worker: Worker | undefined;
  try {
    assertGuiExecution(guard);
    try { worker = await tesseract.createWorker('spa'); }
    catch { assertGuiExecution(guard); worker = await tesseract.createWorker('eng'); }
    assertGuiExecution(guard);
    let abort!: () => void;
    const cancelled = new Promise<never>((_resolve, reject) => { abort = () => reject(new GuiFailure('GUI_CANCELLED')); });
    guard?.signal?.addEventListener('abort', abort, { once: true });
    try {
      assertGuiExecution(guard);
      const result = await Promise.race([worker.recognize(imageBuffer, {}, { blocks: true }), cancelled]);
      assertGuiExecution(guard);
      return selectOcrTarget(result, textToFind);
    } finally { guard?.signal?.removeEventListener('abort', abort); }
  } catch (error) { throw error instanceof GuiFailure ? error : new GuiFailure('GUI_FAILED'); }
  finally { if (worker) await closeWorker(worker); }
}
