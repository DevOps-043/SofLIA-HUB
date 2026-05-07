/**
 * Handlers para los tools `*_remote_node*` y `*_on_node`.
 *
 * Permiten al agente WhatsApp operar instancias remotas de SofLIA: registrar
 * nodos, abrir aplicaciones, ejecutar comandos en background, capturar
 * pantalla y orquestar tareas de computer-use en máquinas remotas.
 *
 * Todos los handlers son delgados — solo validan/extraen args y delegan a
 * `RemoteNodeService`. Las confirmaciones para acciones destructivas las
 * maneja el dispatcher principal antes de invocar este executor.
 */

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
  if (!REMOTE_NODE_TOOLS.has(toolName)) {
    return null;
  }

  try {
    switch (toolName) {
      case 'get_remote_node_host_status':
        return buildResponse(toolName, await remoteNodeService.getHostStatus());

      case 'configure_remote_node_host':
        return buildResponse(toolName, await remoteNodeService.updateHostConfig(toolArgs || {}));

      case 'list_remote_nodes': {
        const nodes = await remoteNodeService.listNodes();
        return buildResponse(toolName, { success: true, count: nodes.length, nodes });
      }

      case 'register_remote_node':
        return buildResponse(
          toolName,
          await remoteNodeService.registerNode({
            id: toolArgs.node_id,
            name: toolArgs.name,
            base_url: toolArgs.base_url,
            token: toolArgs.token,
            enabled: toolArgs.enabled,
          }),
        );

      case 'remove_remote_node':
        return buildResponse(toolName, await remoteNodeService.removeNode(nodeId(toolArgs)));

      case 'test_remote_node':
        return buildResponse(toolName, await remoteNodeService.testNode(nodeId(toolArgs)));

      case 'open_application_on_node':
        return buildResponse(
          toolName,
          await remoteNodeService.openApplicationOnNode(nodeId(toolArgs), toolArgs || {}),
        );

      case 'run_background_command_on_node':
        return buildResponse(
          toolName,
          await remoteNodeService.runBackgroundCommandOnNode(nodeId(toolArgs), toolArgs || {}),
        );

      case 'take_screenshot_on_node':
        return buildResponse(
          toolName,
          await remoteNodeService.takeScreenshotOnNode(nodeId(toolArgs), toolArgs || {}),
        );

      case 'use_computer_on_node':
        return buildResponse(
          toolName,
          await remoteNodeService.executeDesktopTaskOnNode(nodeId(toolArgs), toolArgs || {}),
        );

      case 'list_remote_node_process_sessions':
        return buildResponse(
          toolName,
          await remoteNodeService.listProcessSessionsOnNode(nodeId(toolArgs)),
        );

      case 'poll_remote_node_process_session':
        return buildResponse(
          toolName,
          await remoteNodeService.pollProcessSessionOnNode(
            nodeId(toolArgs),
            String(toolArgs.session_id || '').trim(),
          ),
        );

      case 'kill_remote_node_process_session':
        return buildResponse(
          toolName,
          await remoteNodeService.killProcessSessionOnNode(
            nodeId(toolArgs),
            String(toolArgs.session_id || '').trim(),
          ),
        );

      default:
        return null;
    }
  } catch (err: any) {
    return errorResponse(toolName, err.message);
  }
}
