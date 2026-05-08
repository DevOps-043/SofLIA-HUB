type RemoteNodeAction =
  | 'open_application'
  | 'run_background_command'
  | 'desktop_execute_task'
  | 'list_process_sessions'
  | 'take_screenshot';

export function buildRemoteNodeAction(
  action: RemoteNodeAction,
  args: Record<string, any> = {},
): { method: string; routePath: string; body?: Record<string, any> } {
  if (action === 'open_application') {
    return { method: 'POST', routePath: '/v1/open-application', body: { path: args.path } };
  }
  if (action === 'run_background_command') {
    return {
      method: 'POST',
      routePath: '/v1/run-background-command',
      body: { command: args.command, working_directory: args.working_directory, title: args.title },
    };
  }
  if (action === 'desktop_execute_task') {
    return {
      method: 'POST',
      routePath: '/v1/desktop/execute-task',
      body: {
        task: args.task,
        max_steps: args.max_steps,
        backend: args.backend,
        start_url: args.start_url,
        browser_profile: args.browser_profile,
        browser_isolated: args.browser_isolated,
        reset_browser_profile: args.reset_browser_profile,
      },
    };
  }
  if (action === 'take_screenshot') {
    return { method: 'POST', routePath: '/v1/take-screenshot', body: { display_id: args.display_id } };
  }
  return { method: 'GET', routePath: '/v1/process-sessions' };
}

export function buildProcessSessionRoute(
  action: 'poll' | 'kill',
  sessionId: string,
): { method: string; routePath: string } {
  const encoded = encodeURIComponent(sessionId);
  return {
    method: action === 'poll' ? 'GET' : 'DELETE',
    routePath: `/v1/process-sessions/${encoded}`,
  };
}
