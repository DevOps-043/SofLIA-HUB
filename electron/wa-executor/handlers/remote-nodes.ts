import { remoteNodeService } from '../../remote-node-service';
import { buildResponse, errorResponse, type FunctionResponse } from '../types';

const REMOTE_NODE_TOOLS = new Set([
  'get_remote_node_host_status',
  'configure_remote_node_host',
  'list_remote_nodes',
  'register_remote_node',
  'remove_remote_node',
  'test_remote_node',
  'open_application_on_node',
  'run_background_command_on_node',
  'take_screenshot_on_node',
  'use_computer_on_node',
  'list_remote_node_process_sessions',
  'poll_remote_node_process_session',
  'kill_remote_node_process_session',
]);

export function isRemoteNodeTool(name: string): boolean {
  return REMOTE_NODE_TOOLS.has(name);
}

function nodeId(toolArgs: Record<string, any>): string {
  return String(toolArgs.node_id || '').trim();
}

export async function executeRemoteNodeTool(
  toolName: string,
  toolArgs: Record<string, any>,
): Promise<FunctionResponse | null> {
  if (!REMOTE_NODE_TOOLS.has(toolName)) return null;

  try {
    if (toolName === 'get_remote_node_host_status') return buildResponse(toolName, await remoteNodeService.getHostStatus());
    if (toolName === 'configure_remote_node_host') return buildResponse(toolName, await remoteNodeService.updateHostConfig(toolArgs || {}));
    if (toolName === 'list_remote_nodes') {
      const nodes = await remoteNodeService.listNodes();
      return buildResponse(toolName, { success: true, count: nodes.length, nodes });
    }
    if (toolName === 'register_remote_node') return registerRemoteNode(toolName, toolArgs);
    if (toolName === 'remove_remote_node') return buildResponse(toolName, await remoteNodeService.removeNode(nodeId(toolArgs)));
    if (toolName === 'test_remote_node') return buildResponse(toolName, await remoteNodeService.testNode(nodeId(toolArgs)));
    if (toolName === 'open_application_on_node') return buildResponse(toolName, await remoteNodeService.openApplicationOnNode(nodeId(toolArgs), toolArgs || {}));
    if (toolName === 'run_background_command_on_node') return buildResponse(toolName, await remoteNodeService.runBackgroundCommandOnNode(nodeId(toolArgs), toolArgs || {}));
    if (toolName === 'take_screenshot_on_node') return buildResponse(toolName, await remoteNodeService.takeScreenshotOnNode(nodeId(toolArgs), toolArgs || {}));
    if (toolName === 'use_computer_on_node') return buildResponse(toolName, await remoteNodeService.executeDesktopTaskOnNode(nodeId(toolArgs), toolArgs || {}));
    if (toolName === 'list_remote_node_process_sessions') return buildResponse(toolName, await remoteNodeService.listProcessSessionsOnNode(nodeId(toolArgs)));
    if (toolName === 'poll_remote_node_process_session') return pollProcessSession(toolName, toolArgs);
    if (toolName === 'kill_remote_node_process_session') return killProcessSession(toolName, toolArgs);
    return null;
  } catch (err: any) {
    return errorResponse(toolName, err.message);
  }
}

async function registerRemoteNode(toolName: string, toolArgs: Record<string, any>): Promise<FunctionResponse> {
  return buildResponse(
    toolName,
    await remoteNodeService.registerNode({
      id: toolArgs.node_id,
      name: toolArgs.name,
      base_url: toolArgs.base_url,
      token: toolArgs.token,
      enabled: toolArgs.enabled,
      owner_user_id: toolArgs.owner_user_id,
      organization_id: toolArgs.organization_id,
      visibility: toolArgs.visibility,
    }),
  );
}

async function pollProcessSession(toolName: string, toolArgs: Record<string, any>): Promise<FunctionResponse> {
  return buildResponse(
    toolName,
    await remoteNodeService.pollProcessSessionOnNode(nodeId(toolArgs), String(toolArgs.session_id || '').trim()),
  );
}

async function killProcessSession(toolName: string, toolArgs: Record<string, any>): Promise<FunctionResponse> {
  return buildResponse(
    toolName,
    await remoteNodeService.killProcessSessionOnNode(nodeId(toolArgs), String(toolArgs.session_id || '').trim()),
  );
}
