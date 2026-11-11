type RemoteNodeApi = NonNullable<Window['remoteNode']>;
import type { z } from 'zod';
import { publicRemoteHostStatus, publicRemoteNodeRecord } from '../../shared/remote-node-public';
import { remoteBackgroundCommand, remoteDesktopTask, remoteHostUpdates, remoteNodeId, remoteNodeInputs, remoteNodeRegistration, remoteOpenApplication, remoteScreenshot } from '../../shared/remote-node-input';

function getRemoteNodeApi(): RemoteNodeApi {
  if (!window.remoteNode) throw new Error('Remote Node API no disponible.');
  return window.remoteNode;
}
function input<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new Error('Los datos de nodo remoto no son válidos.');
  return result.data;
}

export async function executeRemoteNodeTool(toolName: string, args: Record<string, unknown>): Promise<unknown | null> {
  if (!toolName.includes('remote_node') && !toolName.endsWith('_on_node') && toolName !== 'use_computer_on_node') {
    return null;
  }

  const api = getRemoteNodeApi();
  if (toolName === 'get_remote_node_host_status') return publicRemoteHostStatus(await api.getHostStatus());
  if (toolName === 'configure_remote_node_host') return publicRemoteHostStatus(await api.updateHostConfig(input(remoteHostUpdates, args)));
  if (toolName === 'list_remote_nodes') {
    const result = await api.listNodes();
    return { ...result, ...(result.nodes ? { nodes: result.nodes.map(publicRemoteNodeRecord) } : {}) };
  }
  if (toolName === 'register_remote_node') {
    const result = await api.registerNode(buildRemoteNode(args));
    return { ...result, ...(result.node ? { node: publicRemoteNodeRecord(result.node) } : {}) };
  }
  const nodeId = () => input(remoteNodeId, args.node_id);
  if (toolName === 'remove_remote_node') return api.removeNode(nodeId());
  if (toolName === 'test_remote_node') return api.testNode(nodeId());
  if (toolName === 'open_application_on_node') return api.openApplication(nodeId(), input(remoteOpenApplication, { path: args.path }));
  if (toolName === 'run_background_command_on_node') return api.runBackgroundCommand(nodeId(), input(remoteBackgroundCommand, { command: args.command, working_directory: args.working_directory, title: args.title }));
  if (toolName === 'take_screenshot_on_node') return api.takeScreenshot(nodeId(), input(remoteScreenshot, { display_id: args.display_id }));
  if (toolName === 'use_computer_on_node') return api.executeTask(nodeId(), input(remoteDesktopTask, {
    task: args.task, max_steps: args.max_steps, backend: args.backend, start_url: args.start_url,
    browser_profile: args.browser_profile, browser_isolated: args.browser_isolated, reset_browser_profile: args.reset_browser_profile,
  }));
  if (toolName === 'list_remote_node_process_sessions') return api.listProcessSessions(nodeId());
  if (toolName === 'poll_remote_node_process_session') return api.pollProcessSession(...input(remoteNodeInputs['poll-process-session'], [args.node_id, args.session_id]));
  if (toolName === 'kill_remote_node_process_session') return api.killProcessSession(...input(remoteNodeInputs['kill-process-session'], [args.node_id, args.session_id]));

  return null;
}

function buildRemoteNode(args: Record<string, unknown>) {
  return input(remoteNodeRegistration, {
    id: args.node_id,
    name: args.name,
    base_url: args.base_url,
    token: args.token,
    enabled: args.enabled,
  });
}
