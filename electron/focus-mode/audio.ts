import { exec } from 'node:child_process';
import os from 'node:os';
import util from 'node:util';

const execPromise = util.promisify(exec);

export async function muteSystemAudio(): Promise<void> {
  const platform = os.platform();
  try {
    if (platform === 'win32') {
      await setWindowsMute(true);
    } else if (platform === 'darwin') {
      await execPromise('osascript -e "set volume with output muted"');
      console.log('[SmartFocus] Audio silenciado (macOS).');
    } else if (platform === 'linux') {
      await execPromise('amixer -D pulse sset Master mute');
      console.log('[SmartFocus] Audio silenciado (Linux - ALSA/SofLIA).');
    } else {
      console.warn(`[SmartFocus] Plataforma ${platform} no soportada para silenciar audio nativamente.`);
    }
  } catch (error: any) {
    console.error(`[SmartFocus] Error critico al silenciar audio: ${error.message}`);
  }
}

export async function restoreSystemAudio(): Promise<void> {
  const platform = os.platform();
  try {
    if (platform === 'win32') {
      await setWindowsMute(false);
    } else if (platform === 'darwin') {
      await execPromise('osascript -e "set volume without output muted"');
      console.log('[SmartFocus] Audio restaurado (macOS).');
    } else if (platform === 'linux') {
      await execPromise('amixer -D pulse sset Master unmute');
      console.log('[SmartFocus] Audio restaurado (Linux - ALSA/SofLIA).');
    } else {
      console.warn(`[SmartFocus] Plataforma ${platform} no soportada para restaurar audio nativamente.`);
    }
  } catch (error: any) {
    console.error(`[SmartFocus] Error critico al restaurar audio: ${error.message}`);
  }
}

async function setWindowsMute(shouldMute: boolean): Promise<void> {
  try {
    await execPromise(`nircmd.exe mutesysvolume ${shouldMute ? '1' : '0'}`);
    console.log(`[SmartFocus] Audio ${shouldMute ? 'silenciado' : 'restaurado'} (Windows - nircmd).`);
  } catch (err) {
    console.warn('[SmartFocus] nircmd no encontrado, usando fallback de PowerShell...', err);
    await execPromise('powershell -Command "$obj = new-object -com wscript.shell; $obj.SendKeys([char]173)"');
    console.log(`[SmartFocus] Audio ${shouldMute ? 'silenciado' : 'restaurado'} (Windows - PowerShell).`);
  }
}
