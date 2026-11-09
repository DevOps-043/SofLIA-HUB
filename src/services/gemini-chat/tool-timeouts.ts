/** Plazos de herramientas cuya ejecución continúa en main. */
export const LONG_RUNNING_TOOL_TIMEOUTS_MS: Record<string, number> = {
  workspace_render_video: 13 * 60_000,
  workspace_inspect_video: 90_000,
  use_computer: 15 * 60_000,
  use_computer_on_node: 15 * 60_000,
};
