import './computer-use/window-types';
import { getComputerUseAPI, getDesktopAgentAPI, isComputerUseAvailable, isDesktopAgentAvailable } from './computer-use/apis';
import { confirmToolExecution, setConfirmationHandler } from './computer-use/confirmation';
import { executeBackgroundTool } from './computer-use/background-tools';
import { executeDesktopTool } from './computer-use/desktop-tools';
import { executeEmailTool } from './computer-use/email-tools';
import { executeLocalComputerTool } from './computer-use/local-tools';
import { executeRemoteNodeTool } from './computer-use/remote-tools';

export { getDesktopAgentAPI, isComputerUseAvailable, isDesktopAgentAvailable, setConfirmationHandler };

export async function executeComputerTool(toolName: string, args: Record<string, any>): Promise<string> {
  const api = getComputerUseAPI();
  const desktopApi = ['use_computer', 'list_browser_profiles', 'reset_browser_profile'].includes(toolName)
    ? getDesktopAgentAPI()
    : null;

  const confirmed = await confirmToolExecution(toolName, args, api);
  if (!confirmed) {
    return JSON.stringify({ success: false, error: 'Accion cancelada por el usuario.' });
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
