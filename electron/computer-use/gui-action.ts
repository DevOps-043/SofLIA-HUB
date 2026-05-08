import { exec } from 'node:child_process';
import os from 'node:os';
import util from 'node:util';

const execAsync = util.promisify(exec);

export async function performGuiAction(action: string, coordinate?: number[], text?: string): Promise<void> {
  const platform = os.platform();
  const [x, y] = coordinate ? [Math.round(coordinate[0]), Math.round(coordinate[1])] : [0, 0];
  const moveMouseWin = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y})`;
  const clickMouseWin = `
$signature = @"
[DllImport("user32.dll",CharSet=CharSet.Auto, CallingConvention=CallingConvention.StdCall)]
public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint cButtons, uint dwExtraInfo);
"@
$mouse = Add-Type -memberDefinition $signature -name "Win32MouseEventNew" -namespace Win32Functions -passThru
$mouse::mouse_event(0x0002, 0, 0, 0, 0)
$mouse::mouse_event(0x0004, 0, 0, 0, 0)
`;
  const typeTextWin = text ? `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${text.replace(/'/g, "''")}')` : '';
  const macMouseScript = `
import Quartz
def mouseEvent(type, posx, posy):
    theEvent = Quartz.CGEventCreateMouseEvent(None, type, (posx,posy), Quartz.kCGMouseButtonLeft)
    Quartz.CGEventPost(Quartz.kCGHIDEventTap, theEvent)
mouseEvent(Quartz.kCGEventMouseMoved, ${x}, ${y})
`;
  const macClickScript = macMouseScript + `
mouseEvent(Quartz.kCGEventLeftMouseDown, ${x}, ${y})
import time
time.sleep(0.05)
mouseEvent(Quartz.kCGEventLeftMouseUp, ${x}, ${y})
`;

  switch (action) {
    case 'mouse_move':
      if (platform === 'win32') await execAsync(`powershell -Command "${moveMouseWin}"`);
      else if (platform === 'darwin') await execAsync(`python3 -c "${macMouseScript}"`);
      else await execAsync(`xdotool mousemove ${x} ${y}`);
      break;
    case 'left_click':
    case 'left_click_drag':
      if (platform === 'win32') await execAsync(`powershell -Command "${moveMouseWin}; ${clickMouseWin}"`);
      else if (platform === 'darwin') await execAsync(`python3 -c "${macClickScript}"`);
      else await execAsync(`xdotool mousemove ${x} ${y} click 1`);
      break;
    case 'right_click':
      if (platform === 'win32') {
        const rightClickWin = clickMouseWin.replace('0x0002', '0x0008').replace('0x0004', '0x0010');
        await execAsync(`powershell -Command "${moveMouseWin}; ${rightClickWin}"`);
      } else if (platform === 'darwin') {
        await execAsync(`python3 -c "${macClickScript.replace(/Left/g, 'Right')}"`);
      } else await execAsync(`xdotool mousemove ${x} ${y} click 3`);
      break;
    case 'middle_click':
      if (platform === 'win32') await execAsync(`powershell -Command "${moveMouseWin}"`);
      else if (platform === 'darwin') await execAsync(`python3 -c "${macClickScript.replace(/Left/g, 'Center')}"`);
      else await execAsync(`xdotool mousemove ${x} ${y} click 2`);
      break;
    case 'double_click':
      if (platform === 'win32') await execAsync(`powershell -Command "${moveMouseWin}; ${clickMouseWin}; Start-Sleep -Milliseconds 50; ${clickMouseWin}"`);
      else if (platform === 'darwin') await execAsync(`python3 -c "${macClickScript}\ntime.sleep(0.05)\n${macClickScript}"`);
      else await execAsync(`xdotool mousemove ${x} ${y} click --repeat 2 1`);
      break;
    case 'type':
      if (!text) throw new Error("Texto requerido para accion 'type'");
      if (platform === 'win32') await execAsync(`powershell -Command "${typeTextWin}"`);
      else if (platform === 'darwin') await execAsync(`osascript -e 'tell application "System Events" to keystroke "${text.replace(/"/g, '\\"')}"'`);
      else await execAsync(`xdotool type "${text}"`);
      break;
    case 'key':
      if (!text) throw new Error("Tecla requerida para accion 'key'");
      if (platform === 'win32') await execAsync(`powershell -Command "${typeTextWin}"`);
      else if (platform === 'darwin') {
        const keyMap: Record<string, string> = { Return: 'return', Enter: 'return', Escape: 'escape', Tab: 'tab' };
        await execAsync(`osascript -e 'tell application "System Events" to keystroke "${keyMap[text] || text}"'`);
      } else await execAsync(`xdotool key "${text}"`);
      break;
    default:
      throw new Error(`Accion GUI no soportada: ${action}`);
  }
}
