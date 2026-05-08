import { registerRemoteNode, takeRemoteNodeScreenshot, testRemoteNode, updateRemoteNodeHostConfig } from '../../../services/remote-node-service';
import { RUN_STATUS_STYLES, inputClass } from './styles';
import { StatusBadge } from './StatusBadge';
import type { AutomationOpsController } from './useAutomationOpsController';

export function RemoteNodesPanel({ controller }: { controller: AutomationOpsController }) {
  const remote = controller.forms.remoteNode;

  return (
    <details className="bg-white dark:bg-[#1a1c20]/50 backdrop-blur-sm border border-gray-200 dark:border-white/10 rounded-2xl p-5 shadow-sm dark:shadow-lg">
      <summary className="cursor-pointer list-none flex items-center justify-between">
        <p className="text-sm font-bold text-gray-900 dark:text-white">Equipos conectados</p>
        <StatusBadge value={controller.data.hostStatus?.running ? 'completed' : 'failed'} styles={RUN_STATUS_STYLES} />
      </summary>
      <div className="mt-4 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <input className={inputClass} value={remote.name} onChange={(event) => remote.setName(event.target.value)} placeholder="Nombre" />
          <input className={inputClass} value={remote.baseUrl} onChange={(event) => remote.setBaseUrl(event.target.value)} placeholder="Base URL" />
          <input className={inputClass} value={remote.token} onChange={(event) => remote.setToken(event.target.value)} placeholder="Token" />
        </div>
        <div className="flex gap-2">
          <button type="button" className="rounded-xl bg-accent hover:bg-accent/90 text-white py-2 px-4 text-xs font-semibold transition disabled:opacity-40" onClick={() => void controller.runner.runAction('register-remote-node', async () => {
            const result = await registerRemoteNode({ name: remote.name.trim(), base_url: remote.baseUrl.trim(), token: remote.token.trim() });
            if (!result.success) throw new Error(result.error || 'No pude registrar.');
            remote.setName('');
            remote.setBaseUrl('http://127.0.0.1:47825');
            remote.setToken('');
            await controller.data.refreshOverview(true);
            controller.runner.setNotice(`Nodo registrado: ${result.node?.name || 'nuevo'}.`);
          })} disabled={controller.runner.actionKey === 'register-remote-node' || !remote.name.trim() || !remote.baseUrl.trim() || !remote.token.trim()}>{controller.runner.actionKey === 'register-remote-node' ? 'Registrando...' : 'Registrar'}</button>
          <button type="button" className="rounded-xl border border-accent/20 bg-accent/10 hover:bg-accent/15 text-accent py-2 px-4 text-xs font-semibold transition disabled:opacity-40" onClick={() => void controller.runner.runAction('toggle-remote-host', async () => {
            if (!controller.data.hostStatus) return;
            const result = await updateRemoteNodeHostConfig({ enabled: !controller.data.hostStatus.enabled });
            controller.data.setHostStatus(result);
            await controller.data.refreshOverview(true);
            controller.runner.setNotice(result.enabled ? 'Host habilitado.' : 'Host deshabilitado.');
          })} disabled={controller.runner.actionKey === 'toggle-remote-host' || !controller.data.hostStatus}>{controller.runner.actionKey === 'toggle-remote-host' ? 'Aplicando...' : controller.data.hostStatus?.enabled ? 'Desactivar' : 'Activar'}</button>
          <button type="button" className="rounded-xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.03] py-2 px-4 text-xs font-semibold text-gray-700 dark:text-gray-200 transition disabled:opacity-40" onClick={() => void controller.runner.runAction('rotate-remote-token', async () => {
            const result = await updateRemoteNodeHostConfig({ rotate_token: true });
            controller.data.setHostStatus(result);
            await controller.data.refreshOverview(true);
            controller.runner.setNotice('Token rotado.');
          })} disabled={controller.runner.actionKey === 'rotate-remote-token'}>{controller.runner.actionKey === 'rotate-remote-token' ? 'Rotando...' : 'Rotar token'}</button>
        </div>
        {controller.data.nodes.map((node) => (
          <div key={node.id} className="rounded-xl border border-gray-200 dark:border-white/[0.06] p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{node.name}</p>
                <p className="text-[10px] text-gray-500 truncate">{node.baseUrl}</p>
              </div>
              <p className={`text-[10px] font-medium ${node.lastError ? 'text-red-500' : 'text-emerald-500'}`}>{node.lastError ? 'Error' : 'OK'}</p>
            </div>
            <div className="mt-2 flex gap-2">
              <button type="button" className="flex-1 rounded-lg border border-gray-200 dark:border-white/[0.06] py-1.5 text-[11px] font-semibold text-gray-700 dark:text-gray-200 transition disabled:opacity-40" onClick={() => void controller.runner.runAction(`test-node-${node.id}`, async () => {
                const result = await testRemoteNode(node.id);
                if (!result.success) throw new Error(result.error || 'Fallo.');
                await controller.data.refreshOverview(true);
                controller.runner.setNotice('Nodo validado.');
              })} disabled={controller.runner.actionKey === `test-node-${node.id}`}>{controller.runner.actionKey === `test-node-${node.id}` ? '...' : 'Probar'}</button>
              <button type="button" className="flex-1 rounded-lg border border-accent/20 bg-accent/10 py-1.5 text-[11px] font-semibold text-accent transition disabled:opacity-40" onClick={() => void controller.runner.runAction(`screenshot-node-${node.id}`, async () => {
                const result = await takeRemoteNodeScreenshot(node.id);
                if (!result.success || !result.image) throw new Error(result.error || 'Fallo.');
                remote.setImage({ nodeId: node.id, image: result.image, capturedAt: new Date().toISOString() });
                controller.runner.setNotice('Captura tomada.');
              })} disabled={controller.runner.actionKey === `screenshot-node-${node.id}`}>{controller.runner.actionKey === `screenshot-node-${node.id}` ? '...' : 'Captura'}</button>
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}
