import type { FunctionResponse } from './types';
import { executeBackgroundSystemTool } from './system-executors/background';
import { executePowerTool } from './system-executors/power';
import { executeProcessTool } from './system-executors/processes';
import { executeVolumeTool } from './system-executors/volume';
import { executeWifiTool } from './system-executors/wifi';
import { SYSTEM_TOOLS } from './system-executors/tool-set';

export function isSystemTool(name: string): boolean {
  return SYSTEM_TOOLS.has(name);
}

export async function executeSystemTool(
  toolName: string,
  toolArgs: Record<string, any>,
): Promise<FunctionResponse | null> {
  if (!SYSTEM_TOOLS.has(toolName)) return null;

  return (
    await executeProcessTool(toolName, toolArgs)
    || await executePowerTool(toolName, toolArgs)
    || await executeVolumeTool(toolName, toolArgs)
    || await executeWifiTool(toolName, toolArgs)
    || await executeBackgroundSystemTool(toolName, toolArgs)
  );
}
