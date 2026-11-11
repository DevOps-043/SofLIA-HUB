import { spawn } from 'node:child_process';
import { assertGuiExecution, GuiFailure, type ComputerExecutionGuard, type GuiFailureCode } from './execution-context';

export const GUI_PROCESS_MS = 15000;
export const GUI_PROCESS_OUTPUT_BYTES = 64 * 1024;
export interface GuiCommand { file: string; args: string[]; input?: string }

/** Sin shell, sin texto en logs y sin resolver antes del cierre físico del hijo. */
export async function runGuiCommand(command: GuiCommand, guard?: ComputerExecutionGuard): Promise<void> {
  assertGuiExecution(guard);
  return new Promise<void>((resolve, reject) => {
    let failure: GuiFailureCode | undefined, bytes = 0, finished = false;
    let child: ReturnType<typeof spawn>;
    try { child = spawn(command.file, command.args, { shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }); }
    catch { reject(new GuiFailure('GUI_UNAVAILABLE')); return; }
    const stop = (reason: GuiFailureCode) => {
      if (finished) return;
      failure ??= reason;
      try { child.kill(); } catch { /* El cierre físico sigue siendo obligatorio. */ }
    };
    const abort = () => stop('GUI_CANCELLED');
    const timer = setTimeout(() => stop('GUI_TIMEOUT'), GUI_PROCESS_MS);
    const cleanup = () => { clearTimeout(timer); guard?.signal?.removeEventListener('abort', abort); };
    const output = (chunk: Buffer | string) => {
      bytes += Buffer.byteLength(chunk); if (bytes > GUI_PROCESS_OUTPUT_BYTES) stop('GUI_OUTPUT_LIMIT');
    };
    child.stdout?.on('data', output); child.stderr?.on('data', output);
    child.stdin?.on('error', () => stop('GUI_FAILED'));
    child.once('error', () => { failure ??= 'GUI_UNAVAILABLE'; });
    child.once('close', (code, signal) => {
      if (finished) return; finished = true; cleanup();
      try {
        assertGuiExecution(guard);
        if (failure || code !== 0 || signal) throw new GuiFailure(failure ?? 'GUI_FAILED');
        resolve();
      } catch (error) { reject(error); }
    });
    guard?.signal?.addEventListener('abort', abort, { once: true });
    if (guard?.signal?.aborted) abort();
    try { assertGuiExecution(guard); child.stdin?.end(command.input ?? ''); }
    catch { stop('GUI_CANCELLED'); child.stdin?.destroy(); }
  });
}
