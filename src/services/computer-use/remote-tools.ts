type RemoteNodeApi = NonNullable<Window['remoteNode']>;

function getRemoteNodeApi(): RemoteNodeApi {
  if (!window.remoteNode) throw new Error('Remote Node API no disponible.');
  return window.remoteNode;
}

export async function executeRemoteNodeTool(toolName: string, args: Record<string, any>): Promise<any | null> {
  if (!toolName.includes('remote_node') && !toolName.endsWith('_on_node') && toolName !== 'use_computer_on_node') {
    return null;
  }

  const api = getRemoteNodeApi();
  if (toolName === 'get_remote_node_host_status') return api.getHostStatus();
  if (toolName === 'configure_remote_node_host') return api.updateHostConfig(args);
  if (toolName === 'list_remote_nodes') return api.listNodes();
  if (toolName === 'register_remote_node') return api.registerNode(buildRemoteNode(args));
  if (toolName === 'remove_remote_node') return api.removeNode(args.node_id);
  if (toolName === 'test_remote_node') return api.testNode(args.node_id);
  if (toolName === 'open_application_on_node') return api.openApplication(args.node_id, { path: args.path });
  if (toolName === 'run_background_command_on_node') return api.runBackgroundCommand(args.node_id, args);
  if (toolName === 'take_screenshot_on_node') return api.takeScreenshot(args.node_id, args);
  if (toolName === 'use_computer_on_node') return api.executeTask(args.node_id, args);
  if (toolName === 'list_remote_node_process_sessions') return api.listProcessSessions(args.node_id);
  if (toolName === 'poll_remote_node_process_session') return api.pollProcessSession(args.node_id, args.session_id);
  if (toolName === 'kill_remote_node_process_session') return api.killProcessSession(args.node_id, args.session_id);

  return null;
}

function buildRemoteNode(args: Record<string, any>) {
  return {
    id: args.node_id,
    name: args.name,
    base_url: args.base_url,
    token: args.token,
    enabled: args.enabled,
  };
}
