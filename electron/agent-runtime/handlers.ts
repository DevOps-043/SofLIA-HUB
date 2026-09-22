import { ipcMain, dialog, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { z } from 'zod';
import type { AgentRuntime } from './runtime';
import { startSchema } from './schemas';
import { sameScope } from './contracts';
export { startSchema } from './schemas';

const runSchema = z.object({ runId: z.string().uuid() }).strict();
export function assertRuntimeSender(event: IpcMainInvokeEvent, window: BrowserWindow | null): void {
  if (!window || window.isDestroyed() || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error('Superficie no autorizada.');
}
export function registerAgentRuntimeHandlers(runtime: AgentRuntime, getWindow: () => BrowserWindow | null): () => void {
  const channels: string[] = [];
  const register = <T>(channel: string, schema: z.ZodType<T>, action: (data: T) => unknown, requiresContext = true) => {
    channels.push(channel);
    ipcMain.handle(channel, async (event, payload: unknown) => {
      try {
        assertRuntimeSender(event, getWindow());
        const parsed = schema.safeParse(payload);
        if (!parsed.success) return { success: false, error: 'Solicitud inválida.' };
        const owner = requiresContext ? runtime.requireContext() : null;
        const data = await action(parsed.data);
        // No entregar resultados de la sesión anterior a un renderer que ya cambió.
        if (owner && runtime.requireContext() !== owner) throw new Error('La sesión cambió.');
        runtime.requireContext();
        return { success: true, data };
      } catch {
        return { success: false, error: 'No se pudo completar la operación. Comprueba sesión, contexto y configuración del proveedor.' };
      }
    });
  };
  register('agent-runtime:context', z.object({ organizationId: z.string().uuid().nullable() }).strict(), async input => {
    const state = await runtime.setContext(input.organizationId);
    if (!sameScope(runtime.requireContext(), state.scope)) throw new Error('El contexto cambió.');
    return state;
  }, false);
  channels.push('agent-runtime:release');
  ipcMain.handle('agent-runtime:release', (event) => {
    try {
      assertRuntimeSender(event, getWindow());
      runtime.invalidate();
      return { success: true, data: null };
    } catch { return { success: false, error: 'Superficie no autorizada.' }; }
  });
  register('agent-runtime:state', z.undefined(), () => runtime.state());
  register('agent-runtime:start', startSchema, input => runtime.harness.start(input));
  register('agent-runtime:cancel', runSchema, input => runtime.harness.cancel(input.runId));
  register('agent-runtime:recover', runSchema, input => runtime.harness.recover(input.runId));
  register('agent-runtime:publish', runSchema.extend({ digest: z.string().regex(/^[a-f0-9]{64}$/) }), input => runtime.harness.publish(input.runId, input.digest));
  register('agent-runtime:codex-key', z.object({ apiKey: z.string().max(500).refine(value => !/[\r\n]/.test(value)) }).strict(), input => {
    runtime.setCodexKey(input.apiKey);
    return runtime.state();
  });
  register('agent-runtime:configure-codex', z.undefined(), async () => {
    const window = getWindow();
    if (!window) throw new Error();
    const scope = runtime.requireContext();
    const selected = await dialog.showOpenDialog(window, {
      title: 'Selecciona el ejecutable nativo de Codex',
      properties: ['openFile'], ...(process.platform === 'win32' ? { filters: [{ name: 'Codex', extensions: ['exe'] }] } : {}),
    });
    if (runtime.requireContext() !== scope) throw new Error('La sesión cambió.');
    if (!selected.canceled && selected.filePaths[0]) await runtime.configureCodex(selected.filePaths[0]);
    return runtime.state();
  });
  const changed = () => {
    const window = getWindow();
    if (window && !window.isDestroyed()) window.webContents.send('agent-runtime:changed');
  };
  runtime.harness.on('changed', changed);
  return () => {
    channels.forEach(channel => ipcMain.removeHandler(channel));
    runtime.harness.off('changed', changed);
  };
}
