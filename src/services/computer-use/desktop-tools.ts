type DesktopAgentApi = NonNullable<Window['desktopAgent']>;

export async function executeDesktopTool(
  toolName: string,
  args: Record<string, any>,
  desktopApi: DesktopAgentApi | null,
): Promise<any | null> {
  if (toolName === 'list_browser_profiles') return desktopApi?.listBrowserProfiles();
  if (toolName === 'reset_browser_profile') return desktopApi?.resetBrowserProfile(args.profile_id);
  if (toolName !== 'use_computer') return null;

  if (!desktopApi) throw new Error('Desktop Agent API no disponible.');
  return desktopApi.executeTask(args.task, {
    maxSteps: args.max_steps,
    backend: args.backend,
    startUrl: args.start_url,
    browserProfile: args.browser_profile,
    browserIsolated: args.browser_isolated,
    resetBrowserProfile: args.reset_browser_profile,
  });
}
