import type { DesktopAgentService } from '../desktop-agent-service';
import { PowerShellWorker } from '../desktop-agent/native-worker/powershell-worker';
import { DeterministicActionError } from '../desktop-agent/action-errors';

/** Verifica identidad y bounds de la ventana real durante la indicación. */
export async function captureDesktopContextGuard(service: DesktopAgentService): Promise<() => Promise<void>> {
  if (process.platform !== 'win32' || !service.visualGuidance || service.config.uiaWorkerEnabled === false) return async () => undefined;
  service.uiaWorker ??= new PowerShellWorker();
  const worker = service.uiaWorker;
  const before = await worker.send({ cmd: 'foreground' });
  if (!before.ok || before.cmd !== 'foreground' || before.handle === '0') throw new DeterministicActionError('No se pudo verificar la ventana objetivo.');
  return async () => {
    const current = await worker.send({ cmd: 'foreground' });
    if (!current.ok || current.cmd !== 'foreground' || current.handle !== before.handle || JSON.stringify(current.rect) !== JSON.stringify(before.rect)) {
      throw new DeterministicActionError('La ventana objetivo cambió durante la indicación. Vuelve a observar.');
    }
  };
}
