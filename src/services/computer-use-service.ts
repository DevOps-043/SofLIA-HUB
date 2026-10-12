import './computer-use/window-types';
import { getComputerUseAPI, getDesktopAgentAPI, isComputerUseAvailable, isDesktopAgentAvailable } from './computer-use/apis';
import { confirmToolExecution, setConfirmationHandler } from './computer-use/confirmation';
import { executeBackgroundTool } from './computer-use/background-tools';
import { executeDesktopTool } from './computer-use/desktop-tools';
import { executeEmailTool } from './computer-use/email-tools';
import { executeLocalComputerTool } from './computer-use/local-tools';
import { executeRemoteNodeTool } from './computer-use/remote-tools';
import { orbGuidanceService } from './orb-guidance-service';

export { getDesktopAgentAPI, isComputerUseAvailable, isDesktopAgentAvailable, setConfirmationHandler };

export async function executeComputerTool(toolName: string, args: Record<string, any>, signal?: AbortSignal): Promise<string> {
  const api = getComputerUseAPI();
  const desktopApi = ['use_computer', 'list_browser_profiles', 'reset_browser_profile'].includes(toolName)
    ? getDesktopAgentAPI()
    : null;

  const confirmed = await confirmToolExecution(toolName, args, api, signal);
  if (!confirmed || signal?.aborted) {
    return JSON.stringify({ success: false, error: 'Accion cancelada por el usuario.' });
  }

  if (toolName === 'show_visual_guidance') {
    const request = { targetText: args.target_text, instruction: args.instruction, ...(args.style ? { style: args.style } : {}) };
    return JSON.stringify(await orbGuidanceService.showTarget(request));
  }

  let result =
    await executeLocalComputerTool(toolName, args, api)
    ?? await executeBackgroundTool(toolName, args, api)
    ?? await executeDesktopTool(toolName, args, desktopApi)
    ?? await executeRemoteNodeTool(toolName, args)
    ?? await executeEmailTool(toolName, args, api)
    ?? { success: false, error: `Herramienta desconocida: ${toolName}` };

  if (typeof result === 'string') {
    result = { success: true, message: result };
  }

  return JSON.stringify(result);
}
