import { windowsVirtualKey } from '../../desktop-agent/windows-hotkey';
import { detectPlatformCapabilities } from '../../platform-capabilities';
import { GuiFailure } from './execution-context';
import { parseGuiKeys, windowsLiteralText, type GuiInput } from './input';
import type { GuiCommand } from './process';
import { WINDOWS_GUI_SCRIPT } from './windows-script';
import { MAC_MOUSE_SCRIPT, MAC_TYPE_SCRIPT } from './mac-script';

const MAC_KEY_SCRIPT = `on run argv
 set heldModifiers to {}
 tell application "System Events"
  if (item 3 of argv) contains "ctrl" then set end of heldModifiers to control down
  if (item 3 of argv) contains "alt" then set end of heldModifiers to option down
  if (item 3 of argv) contains "shift" then set end of heldModifiers to shift down
  if (item 3 of argv) contains "meta" then set end of heldModifiers to command down
  if (item 1 of argv) is "code" then
   key code ((item 2 of argv) as integer) using heldModifiers
  else
   keystroke (item 2 of argv) using heldModifiers
  end if
 end tell
end run`;
const macCodes: Readonly<Record<string, number>> = { enter: 36, tab: 48, space: 49, escape: 53, backspace: 51, delete: 117, up: 126, down: 125, left: 123, right: 124, home: 115, end: 119, pageup: 116, pagedown: 121, ctrl: 59, alt: 58, shift: 56, meta: 55 };
const macFunctionCodes = [122, 120, 99, 118, 96, 97, 98, 100, 101, 109, 103, 111, 105, 107, 113, 106, 64, 79, 80, 90];
const xKeys: Readonly<Record<string, string>> = { enter: 'Return', escape: 'Escape', backspace: 'BackSpace', delete: 'Delete', pageup: 'Prior', pagedown: 'Next', meta: 'Super_L', ctrl: 'Control_L', alt: 'Alt_L', shift: 'Shift_L', tab: 'Tab', up: 'Up', down: 'Down', left: 'Left', right: 'Right', home: 'Home', end: 'End' };
const encoded = (data: unknown) => Buffer.from(JSON.stringify(data), 'utf8').toString('base64');

export function buildGuiCommand(input: GuiInput, platform: NodeJS.Platform): GuiCommand {
  const action = input.action ?? 'screenshot';
  if (action === 'screenshot') throw new GuiFailure('GUI_INVALID_INPUT');
  const keys = action === 'key' ? parseGuiKeys(input.text ?? '') : undefined;
  if (!['type', 'key'].includes(action) && !input.coordinate) throw new GuiFailure('GUI_INVALID_INPUT');
  const [x, y] = input.coordinate ?? [0, 0];
  if (platform === 'win32') return {
    file: 'powershell.exe', args: ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(WINDOWS_GUI_SCRIPT, 'utf16le').toString('base64')],
    input: encoded({ action, x, y, ...(action === 'type' ? { text: windowsLiteralText(input.text!) } : {}), ...(keys ? { keys: keys.map(windowsVirtualKey) } : {}) }),
  };
  if (platform === 'darwin') {
    if (action === 'type') return { file: '/usr/bin/osascript', args: ['-e', MAC_TYPE_SCRIPT, '--', input.text!] };
    if (keys) {
      const last = keys[keys.length - 1];
      const code = macCodes[last] ?? (/^f\d+$/.test(last) ? macFunctionCodes[Number(last.slice(1)) - 1] : undefined);
      if (code === undefined && !/^[a-z0-9]$/.test(last)) throw new GuiFailure('GUI_INVALID_INPUT');
      return { file: '/usr/bin/osascript', args: ['-e', MAC_KEY_SCRIPT, '--', code === undefined ? 'text' : 'code', String(code ?? last), keys.slice(0, -1).join(',')] };
    }
    return { file: 'python3', args: ['-c', MAC_MOUSE_SCRIPT], input: encoded({ action, x, y }) };
  }
  if (platform !== 'linux' || !detectPlatformCapabilities(platform).linuxXdotool) throw new GuiFailure('GUI_UNAVAILABLE');
  if (action === 'type') return { file: 'xdotool', args: ['type', '--clearmodifiers', '--delay', '0', '--file', '-'], input: input.text! };
  if (keys) return { file: 'xdotool', args: ['key', '--clearmodifiers', keys.map(key => xKeys[key] ?? (/^f\d+$/.test(key) ? key.toUpperCase() : key)).join('+')] };
  const move = ['mousemove', '--sync', '--', String(x), String(y)];
  if (action === 'mouse_move') return { file: 'xdotool', args: move };
  if (action === 'left_click_drag') return { file: 'xdotool', args: ['mousedown', '1', ...move, 'mouseup', '1'] };
  const button = action === 'right_click' ? '3' : action === 'middle_click' ? '2' : '1';
  return { file: 'xdotool', args: [...move, 'click', ...(action === 'double_click' ? ['--repeat', '2', '--delay', '50'] : []), button] };
}
