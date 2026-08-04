import { Notification } from 'electron';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export async function triggerNativeAlarm(message: string, soundDuration: number): Promise<void> {
  showNativeNotification(message);
  await playPlatformAlarm(message, soundDuration);
}

function showNativeNotification(message: string): void {
  if (!Notification.isSupported()) {
    console.warn('[PcAlarmService] Las notificaciones nativas no estan soportadas en este sistema operativo');
    return;
  }

  new Notification({
    title: 'SofLIA Alarma',
    body: message,
    urgency: 'critical',
  }).show();
}

async function playPlatformAlarm(message: string, soundDuration: number): Promise<void> {
  if (process.platform === 'win32') {
    await execAsync(`powershell -c "[console]::beep(1000, ${soundDuration})"`);
    return;
  }
  if (process.platform === 'darwin') {
    await execAsync(`say "Alarma: ${message}"`);
    return;
  }
  if (process.platform === 'linux') {
    try {
      await execAsync(`spd-say "Alarma: ${message}"`);
    } catch {
      console.log('[PcAlarmService] No se encontraron herramientas de audio por defecto en Linux');
    }
  }
}
