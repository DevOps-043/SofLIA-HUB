type ComputerUseApi = NonNullable<Window['computerUse']>;

export async function executeBackgroundTool(
  toolName: string,
  args: Record<string, any>,
  api: ComputerUseApi,
): Promise<any | null> {
  if (toolName === 'run_background_command') return api.runBackgroundCommand(args);
  if (toolName === 'list_process_sessions') return api.listProcessSessions();
  if (toolName === 'poll_process_session') return api.pollProcessSession(args.session_id);
  if (toolName === 'kill_process_session') return api.killProcessSession(args.session_id);

  const backgroundHost = (window as any).backgroundHost;
  if (toolName === 'get_background_host_status') {
    if (!backgroundHost) throw new Error('Background Host API no disponible.');
    return backgroundHost.getStatus();
  }
  if (toolName === 'repair_background_host') {
    if (!backgroundHost) throw new Error('Background Host API no disponible.');
    return backgroundHost.repair();
  }

  return null;
}
