import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import type { z } from 'zod';
import { remoteNodeService } from './remote-node-service';
import { nativeConfirmation, trustedAppCaller } from './ipc/caller-authorization';
import { remoteNodeBaseUrl, remoteNodeInputs, remoteNodeSnapshot } from '../src/shared/remote-node-input';
import type { RemoteNodeOperationContext } from './remote-node/operation-context';
import { sanitizeNodeId } from './remote-node/state-utils';
import { createLogger } from './utils/logger';
import { withCorrelation } from './utils/correlation';
import { RemoteNodeStorageUnavailableError } from './remote-node/state-store';

const log = createLogger('nodos-remotos-ipc');
type Review = { context: RemoteNodeOperationContext; target(nodeId: string): Promise<string> };
/** Frontera IPC: no adjuntar causas con rutas, credenciales o errores de proveedores. */
function rejectHost(message: string): never { throw new Error(message); }
export function registerRemoteNodeHandlers(getMainWindow: () => BrowserWindow | null, getOrbWindow: () => BrowserWindow | null = () => null): void {
  const windows = () => [getMainWindow(), getOrbWindow()];
  const confirm = nativeConfirmation('Autorizar operación de nodo remoto');
  const handle = <A extends unknown[]>(
    name: keyof typeof remoteNodeInputs, schema: z.ZodType<A>,
    operation: (context: RemoteNodeOperationContext, ...args: A) => Promise<unknown>,
    review?: (review: Review, ...args: A) => Promise<string>, effects = false,
  ) => {
    ipcMain.handle('remote-node:' + name, (event: IpcMainInvokeEvent, ...args: unknown[]) => withCorrelation(async () => {
      let caller: ReturnType<typeof trustedAppCaller> | undefined;
      let phase = 'authorization'; let admitted = false;
      const started = Date.now();
      try {
        caller = trustedAppCaller(event, windows); caller.assert();
        phase = 'validation'; const input = schema.parse(remoteNodeSnapshot(args));
        phase = 'review';
        const context = await remoteNodeService.captureConfigurationReview({ assertCurrent: caller.assert, signal: caller.signal, onDispatch: () => { admitted = true; } });
        const target = async (nodeId: string) => {
          const nodes = await remoteNodeService.listNodes(); context.assertCurrent();
          const node = nodes.find(item => item.id === nodeId);
          if (!node) throw new Error('Nodo no disponible.');
          return JSON.stringify({ id: node.id, nombre: node.name, destino: remoteNodeBaseUrl.parse(node.baseUrl) });
        };
        if (review) {
          const detail = await review({ context, target }, ...input); context.assertCurrent();
          if (!caller.parent || !await confirm(caller.parent, detail, context.assertCurrent, context.signal)) {
            if (name === 'update-host-config') throw new Error('cancelled');
            return { success: false, cancelled: true, code: 'CANCELLED', error: 'Operación de nodo remoto cancelada.' };
          }
        }
        context.assertCurrent(); phase = 'execution';
        const result = await operation(context, ...input); caller.assert();
        log.info({ channel: name, durationMs: Date.now() - started }, 'Operación de nodo remoto completada.');
        return result;
      } catch (cause) {
        const uncertain = admitted && effects;
        log.warn({ channel: name, durationMs: Date.now() - started, uncertain }, 'Operación de nodo remoto rechazada o fallida.');
        const error = uncertain ? 'La operación puede haberse aplicado. Revisa el nodo antes de repetir.' : cause instanceof RemoteNodeStorageUnavailableError ? cause.message : 'No se pudo completar la operación. Revisa sesión, datos y confirmación.';
        if (name === 'get-host-status' || name === 'update-host-config') return rejectHost(error);
        return { success: false, error, code: uncertain ? 'REMOTE_NODE_UNCERTAIN' : phase === 'validation' ? 'INVALID_PAYLOAD' : 'REMOTE_NODE_DENIED',
          ...(uncertain ? { uncertain: true } : phase === 'review' ? { cancelled: true } : {}) };
      } finally { caller?.dispose(); }
    }));
  };
  const nodeReview = async ({ target }: Review, nodeId: string, input?: unknown) => 'Equipo: ' + await target(nodeId) + '\nArgumentos: ' + JSON.stringify(input ?? {});
  handle('get-host-status', remoteNodeInputs['get-host-status'], () => remoteNodeService.getHostStatus());
  handle('update-host-config', remoteNodeInputs['update-host-config'], (context, updates) => remoteNodeService.updateHostConfig(updates, context), async ({ context }, updates) => {
    const status = await remoteNodeService.getHostStatus(); context.assertCurrent();
    return 'Cambiar host local: ' + JSON.stringify({ nombre: status.node_name, interfaz: status.bind_address, puerto: status.port, habilitado: status.enabled }) + '\nCambios: ' + JSON.stringify(updates);
  }, true);
  handle('list-nodes', remoteNodeInputs['list-nodes'], async () => ({ success: true, nodes: await remoteNodeService.listNodes() }));
  handle('register-node', remoteNodeInputs['register-node'], (context, node) => remoteNodeService.registerNode(node, context), async ({ context }, input) => {
    const nodes = await remoteNodeService.listNodes(); context.assertCurrent();
    const id = sanitizeNodeId(input.id || input.name || input.base_url);
    const previous = nodes.find(node => node.id === id);
    const previousUrl = previous && remoteNodeBaseUrl.safeParse(previous.baseUrl);
    const { token: _token, ...details } = input;
    return 'Registrar o reemplazar nodo: ' + JSON.stringify({ ...details, id, token_configured: Boolean(_token), reemplaza: previous ? { nombre: previous.name, destino: previousUrl?.success ? previousUrl.data : 'Destino previo no válido' } : null });
  }, true);
  handle('remove-node', remoteNodeInputs['remove-node'], (context, id) => remoteNodeService.removeNode(id, context), async (review, id) => 'Eliminar registro local. ' + await nodeReview(review, id), true);
  handle('test-node', remoteNodeInputs['test-node'], (context, id) => remoteNodeService.testNode(id, context));
  handle('open-application', remoteNodeInputs['open-application'], (context, id, args) => remoteNodeService.openApplicationOnNode(id, args, context), async (review, id, args) => 'Abrir aplicación. ' + await nodeReview(review, id, args), true);
  handle('run-background-command', remoteNodeInputs['run-background-command'], (context, id, args) => remoteNodeService.runBackgroundCommandOnNode(id, args, context), async (review, id, args) => 'Ejecutar comando remoto. ' + await nodeReview(review, id, args), true);
  handle('execute-task', remoteNodeInputs['execute-task'], (context, id, args) => remoteNodeService.executeDesktopTaskOnNode(id, args, context), async (review, id, args) => 'Ejecutar tarea remota. ' + await nodeReview(review, id, args), true);
  handle('take-screenshot', remoteNodeInputs['take-screenshot'], (context, id, args?) => remoteNodeService.takeScreenshotOnNode(id, args ?? {}, context), async (review, id, args?) => 'Capturar pantalla remota. ' + await nodeReview(review, id, args));
  handle('list-process-sessions', remoteNodeInputs['list-process-sessions'], (context, id) => remoteNodeService.listProcessSessionsOnNode(id, context));
  handle('poll-process-session', remoteNodeInputs['poll-process-session'], (context, id, session) => remoteNodeService.pollProcessSessionOnNode(id, session, context));
  handle('kill-process-session', remoteNodeInputs['kill-process-session'], (context, id, session) => remoteNodeService.killProcessSessionOnNode(id, session, context), async (review, id, session) => 'Terminar proceso remoto. ' + await nodeReview(review, id, { session_id: session }), true);
}
