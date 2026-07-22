import { ipcMain } from 'electron';
import type { DesktopAgentService } from '../desktop-agent-service';
import { denyIfUnauthenticated } from '../main/require-auth';
import { getErrorMessage } from './errors';

type PrimitiveResult = { success: boolean; error?: string; message?: string };

/**
 * Registra una primitiva de mouse/teclado negando por defecto sin sesion.
 * Todas producen efectos reales sobre la maquina del usuario, asi que ninguna
 * queda exenta del guard.
 */
function handleGuardedPrimitive(
  channel: string,
  handler: (...args: never[]) => Promise<void>,
): void {
  ipcMain.handle(channel, async (_event, ...args: unknown[]): Promise<PrimitiveResult> => {
    const denegado = denyIfUnauthenticated(channel);
    if (denegado) return { success: false, error: denegado.error, message: denegado.message };
    try {
      // El canal IPC entrega argumentos sin tipar; cada primitiva declara su
      // firma concreta arriba y el cast se limita a este punto de entrada.
      await (handler as (...primitiveArgs: unknown[]) => Promise<void>)(...args);
      return { success: true };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  });
}

export function registerDesktopAgentPrimitiveHandlers(agentService: DesktopAgentService) {
  handleGuardedPrimitive('desktop-agent:click', (x: number, y: number) => agentService.mouseClick(x, y));
  handleGuardedPrimitive('desktop-agent:double-click', (x: number, y: number) => agentService.mouseDoubleClick(x, y));
  handleGuardedPrimitive('desktop-agent:right-click', (x: number, y: number) => agentService.mouseRightClick(x, y));
  handleGuardedPrimitive('desktop-agent:drag', (x1: number, y1: number, x2: number, y2: number) =>
    agentService.mouseDrag(x1, y1, x2, y2));
  handleGuardedPrimitive('desktop-agent:type', (text: string) => agentService.keyboardType(text));
  handleGuardedPrimitive('desktop-agent:key', (key: string) => agentService.keyboardKey(key));
  handleGuardedPrimitive('desktop-agent:scroll', (direction: 'up' | 'down', amount?: number) =>
    agentService.mouseScroll(direction, amount));
}
