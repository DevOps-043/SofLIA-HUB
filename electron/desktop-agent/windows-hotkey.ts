/** Códigos virtuales cerrados: no insertar nombres de teclas arbitrarios en scripts. */
export function windowsVirtualKey(name: string): number {
  const key = name.trim().toLowerCase();
  const known: Record<string, number> = { ctrl: 0x11, control: 0x11, alt: 0x12, shift: 0x10, win: 0x5b, meta: 0x5b, super: 0x5b, cmd: 0x5b, command: 0x5b,
    enter: 0x0d, return: 0x0d, tab: 9, esc: 0x1b, escape: 0x1b, space: 0x20, backspace: 8, delete: 0x2e,
    up: 0x26, down: 0x28, left: 0x25, right: 0x27, home: 0x24, end: 0x23, pageup: 0x21, pagedown: 0x22 };
  if (known[key] !== undefined) return known[key];
  if (/^[a-z0-9]$/.test(key)) return key.toUpperCase().charCodeAt(0);
  if (/^f(?:[1-9]|1[0-9]|2[0-4])$/.test(key)) return 0x70 + Number(key.slice(1)) - 1;
  throw new Error('La combinación contiene una tecla no soportada en Windows.');
}

export function buildWindowsHotkey(keys: string[]): string {
  if (!keys.length) throw new Error('La combinación de teclas está vacía.');
  const codes = keys.map(windowsVirtualKey);
  const down = codes.map(key => `[SofliaInput.Keys]::keybd_event(${key},0,0,[UIntPtr]::Zero)`).join('\n');
  const up = [...codes].reverse().map(key => `[SofliaInput.Keys]::keybd_event(${key},0,2,[UIntPtr]::Zero)`).join('\n');
  return `Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern void keybd_event(byte key, byte scan, uint flags, System.UIntPtr extra);' -Name Keys -Namespace SofliaInput\ntry {\n${down}\nStart-Sleep -Milliseconds 50\n} finally {\n${up}\n}`;
}
