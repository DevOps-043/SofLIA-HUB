import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';

const execAsync = promisify(exec);

export const mediaControllerSchema: any = z.object({
  action: z.enum(['play_pause', 'next', 'prev', 'vol_up', 'vol_down', 'mute'], {
    description: 'La acción multimedia a ejecutar',
  }),
});

export const mediaControllerTool = {
  name: 'media_controller',
  description: 'Controla reproducción multimedia y presentaciones en la PC remotamente. Emula las teclas físicas del teclado (Play/Pausa, Volumen, Siguiente, Anterior, Mute). Útil para pausar música o videos, o pasar diapositivas a distancia.',
  schema: mediaControllerSchema,
  handler: async (input: any) => {
    try {
      const isWin = process.platform === 'win32';
      const isMac = process.platform === 'darwin';
      const isLinux = process.platform === 'linux';

      if (isWin) {
        // Códigos de teclas virtuales (Virtual-Key Codes) en Windows
        // https://learn.microsoft.com/en-us/windows/win32/inputdev/virtual-key-codes
        const keyMap: Record<string, number> = {
          mute: 173,       // VK_VOLUME_MUTE
          vol_down: 174,   // VK_VOLUME_DOWN
          vol_up: 175,     // VK_VOLUME_UP
          next: 176,       // VK_MEDIA_NEXT_TRACK
          prev: 177,       // VK_MEDIA_PREV_TRACK
          play_pause: 179, // VK_MEDIA_PLAY_PAUSE
        };

        const keyCode = keyMap[input.action];
        if (!keyCode) {
          throw new Error(`Acción no soportada en Windows: ${input.action}`);
        }

        // Usamos P/Invoke con C# embebido en PowerShell para simular eventos de hardware reales
        // Esto garantiza que aplicaciones en segundo plano (Spotify, VLC, YouTube) reciban la tecla
        const psScript = `
$code = 'using System; using System.Runtime.InteropServices; public class KeySender { [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo); public static void Send(byte key) { keybd_event(key, 0, 0, 0); keybd_event(key, 0, 2, 0); } }'
Add-Type -TypeDefinition $code
[KeySender]::Send(${keyCode})
`;
        
        // Codificar en Base64 UTF-16LE para evitar cualquier problema de escape de comillas en cmd.exe
        const base64Script = Buffer.from(psScript, 'utf16le').toString('base64');
        
        await execAsync(`powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${base64Script}`, { windowsHide: true });
        return { success: true, message: `Acción multimedia '${input.action}' ejecutada con éxito en Windows.` };
      } 
      else if (isMac) {
        // En macOS, simulamos las teclas de función equivalentes a controles multimedia
        const macKeyMap: Record<string, number> = {
          prev: 98,        // F7
          play_pause: 100, // F8
          next: 101,       // F9
          vol_down: 103,   // F11
          vol_up: 111,     // F12
          mute: 109        // F10
        };

        const keyCode = macKeyMap[input.action];
        if (keyCode) {
          await execAsync(`osascript -e 'tell application "System Events" to key code ${keyCode}'`);
          return { success: true, message: `Acción multimedia '${input.action}' ejecutada con éxito en macOS.` };
        } else {
          throw new Error(`Acción no soportada en macOS: ${input.action}`);
        }
      } 
      else if (isLinux) {
        // En Linux usamos xdotool (herramienta estándar en X11)
        const linuxKeyMap: Record<string, string> = {
          play_pause: 'XF86AudioPlay',
          next: 'XF86AudioNext',
          prev: 'XF86AudioPrev',
          vol_up: 'XF86AudioRaiseVolume',
          vol_down: 'XF86AudioLowerVolume',
          mute: 'XF86AudioMute'
        };

        const keySym = linuxKeyMap[input.action];
        try {
          await execAsync(`xdotool key ${keySym}`);
          return { success: true, message: `Acción multimedia '${input.action}' ejecutada en Linux via xdotool.` };
        } catch (err: any) {
          throw new Error(`Fallo en Linux (requiere xdotool instalado): ${err.message}`);
        }
      } 
      else {
        throw new Error(`Plataforma no soportada: ${process.platform}`);
      }
    } catch (error: any) {
      console.error(`[Media Controller] Error ejecutando ${input.action}:`, error);
      return { success: false, error: error.message };
    }
  }
};
