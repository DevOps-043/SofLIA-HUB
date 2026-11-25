import { COMPUTER_NATIVE_REVIEWED_TOOLS } from '../../shared/computer-use-policy';

/** Plazos de herramientas cuya ejecución continúa en main. */
export const LONG_RUNNING_TOOL_TIMEOUTS_MS: Record<string, number> = {
  ...Object.fromEntries(Array.from(COMPUTER_NATIVE_REVIEWED_TOOLS, tool => [tool, 150_000])),
  workspace_render_video: 13 * 60_000,
  workspace_inspect_video: 90_000,
  use_computer: 15 * 60_000,
  use_computer_on_node: 15 * 60_000,
  navigate_integrated_browser: 45_000,
  inspect_browser_downloads: 60_000,
  reset_browser_profile: 150_000,
};
