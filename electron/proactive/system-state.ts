import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { SystemAlert } from './types';

const execAsync = promisify(exec);

export async function checkSystemState(): Promise<SystemAlert[]> {
  const alerts: SystemAlert[] = [];
  try {
    await collectProcessAlerts(alerts);
    await collectMemoryAlert(alerts);
  } catch (error) {
    console.warn('[ProactiveService] System state check failed:', error);
  }
  return alerts;
}

async function collectProcessAlerts(alerts: SystemAlert[]): Promise<void> {
  const { stdout } = await execAsync(
    'powershell -Command "Get-Process | Sort-Object CPU -Descending | Select-Object -First 5 Name, Id, @{N=\'CPU_Seconds\';E={[math]::Round($_.CPU,1)}}, @{N=\'Memory_MB\';E={[math]::Round($_.WorkingSet64/1MB,0)}} | ConvertTo-Json"',
    { timeout: 10000 },
  );
  const processes = JSON.parse(stdout);
  const processList = Array.isArray(processes) ? processes : [processes];
  for (const proc of processList) {
    if (proc.Memory_MB <= 2048) continue;
    alerts.push({
      type: 'high_memory',
      description: `${proc.Name} está usando ${proc.Memory_MB} MB de memoria RAM`,
      processName: proc.Name,
      value: proc.Memory_MB,
    });
  }
}

async function collectMemoryAlert(alerts: SystemAlert[]): Promise<void> {
  const { stdout } = await execAsync(
    'powershell -Command "(Get-CimInstance Win32_OperatingSystem | Select-Object @{N=\'UsedPercent\';E={[math]::Round((($_.TotalVisibleMemorySize - $_.FreePhysicalMemory) / $_.TotalVisibleMemorySize) * 100, 1)}}).UsedPercent"',
    { timeout: 10000 },
  );
  const memPercent = parseFloat(stdout.trim());
  if (memPercent > 85) {
    alerts.push({
      type: 'high_memory',
      description: `La memoria RAM del sistema está al ${memPercent}%`,
      value: memPercent,
    });
  }
}
