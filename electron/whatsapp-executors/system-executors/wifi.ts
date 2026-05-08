import { toolError, toolResponse } from '../types';
import type { FunctionResponse } from '../types';
import { execAsync } from './exec';

export async function executeWifiTool(toolName: string, toolArgs: Record<string, any>): Promise<FunctionResponse | null> {
  if (toolName !== 'toggle_wifi') return null;

  try {
    const action = toolArgs.enable ? 'enable' : 'disable';
    await execAsync(
      `powershell -NoProfile -Command "$adapter = Get-NetAdapter -Physical | Where-Object { $_.MediaType -eq '802.3' -or $_.Name -match 'Wi-Fi|WiFi|Wireless|WLAN' -and $_.InterfaceDescription -match 'Wi-Fi|WiFi|Wireless|WLAN' } | Select-Object -First 1; if (-not $adapter) { $adapter = Get-NetAdapter | Where-Object { $_.Name -match 'Wi-Fi|WiFi|Wireless|WLAN' } | Select-Object -First 1 }; if ($adapter) { ${action === 'enable' ? 'Enable-NetAdapter' : 'Disable-NetAdapter'} -Name $adapter.Name -Confirm:$false } else { throw 'No se encontro adaptador Wi-Fi' }"`,
      { timeout: 15000, windowsHide: true },
    );
    return toolResponse(toolName, { success: true, message: toolArgs.enable ? 'Wi-Fi activado.' : 'Wi-Fi desactivado.' });
  } catch (err: any) {
    return toolError(toolName, err.message);
  }
}
