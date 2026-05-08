export const SEND_KEYS_MAP: Record<string, string> = {
  'enter': '{ENTER}', 'tab': '{TAB}', 'escape': '{ESC}', 'esc': '{ESC}',
  'backspace': '{BACKSPACE}', 'delete': '{DELETE}', 'space': ' ',
  'up': '{UP}', 'down': '{DOWN}', 'left': '{LEFT}', 'right': '{RIGHT}',
  'home': '{HOME}', 'end': '{END}', 'pageup': '{PGUP}', 'pagedown': '{PGDN}',
  'ctrl+a': '^a', 'ctrl+c': '^c', 'ctrl+v': '^v', 'ctrl+s': '^s',
  'ctrl+z': '^z', 'ctrl+y': '^y', 'ctrl+x': '^x', 'ctrl+f': '^f',
  'ctrl+n': '^n', 'ctrl+o': '^o', 'ctrl+p': '^p', 'ctrl+w': '^w',
  'ctrl+t': '^t', 'ctrl+shift+n': '^+n', 'ctrl+shift+t': '^+t',
  'ctrl+enter': '^{ENTER}', 'ctrl+shift+enter': '^+{ENTER}',
  'alt+f4': '%{F4}', 'alt+tab': '%{TAB}', 'alt+enter': '%{ENTER}',
  'shift+tab': '+{TAB}', 'shift+enter': '+{ENTER}',
  'win': '^{ESC}', 'win+d': '^{ESC}d', 'win+e': '^{ESC}e',
  'win+r': '^{ESC}r', 'win+l': '^{ESC}l',
  'f1': '{F1}', 'f2': '{F2}', 'f3': '{F3}', 'f4': '{F4}', 'f5': '{F5}',
  'f6': '{F6}', 'f7': '{F7}', 'f8': '{F8}', 'f9': '{F9}', 'f10': '{F10}',
  'f11': '{F11}', 'f12': '{F12}',
};

export const PINVOKE_HEADER = `Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y); [DllImport("user32.dll")] public static extern void mouse_event(int f,int x,int y,int d,int e);' -Name U -Namespace W`;

export const LEFTDOWN = 2;
export const LEFTUP = 4;
export const RIGHTDOWN = 0x0008;
export const RIGHTUP = 0x0010;
export const WHEEL = 0x0800;
