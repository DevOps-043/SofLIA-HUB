const aliases: Readonly<Record<string, string>> = { control: 'ctrl', control_l: 'ctrl', control_r: 'ctrl', cmd: 'meta', command: 'meta', win: 'meta', super: 'meta', option: 'alt', return: 'enter', esc: 'escape', del: 'delete', pgup: 'pageup', pgdn: 'pagedown', page_up: 'pageup', page_down: 'pagedown' };
const modifiers = new Set(['ctrl', 'alt', 'shift', 'meta']);
const named = new Set(['enter', 'escape', 'tab', 'space', 'backspace', 'delete', 'up', 'down', 'left', 'right', 'home', 'end', 'pageup', 'pagedown']);
const punctuation = new Set(['+', '.', ',', ';', '-', '=', '/', '[', ']', '\\', "'", '`']);
/** Tokens canónicos, no código SendKeys ni fragmentos de script. */
export function desktopKeys(input: string): string[] {
  if (typeof input !== 'string' || !input.trim() || input.length > 160) throw new Error('Combinación de teclado no válida.');
  let value = input.trim();
  if (/^[\^%+]*\{?[a-zA-Z0-9]+\}?$/.test(value) && /^[\^%+{]/.test(value)) {
    const prefix = value.match(/^[\^%+]*/)?.[0] ?? '';
    value = [...Array.from(prefix).map(c => ({ '^': 'ctrl', '%': 'alt', '+': 'shift' })[c]), value.slice(prefix.length).replace(/^\{([^{}]+)\}$/, '$1')].join('+');
  }
  const tokens = value === '+' ? ['+'] : value.endsWith('++') ? [...value.slice(0, -2).split('+'), '+'] : value.split('+');
  const keys = tokens.map(key => aliases[key.toLowerCase()] ?? key.toLowerCase());
  const last = keys[keys.length - 1];
  if (keys.length > 5 || keys.some(key => !key) || new Set(keys).size !== keys.length || keys.slice(0, -1).some(key => !modifiers.has(key))
    || keys.length > 1 && modifiers.has(last) || !named.has(last) && !modifiers.has(last) && !/^[a-z0-9]$/.test(last) && !punctuation.has(last) && !/^f(?:[1-9]|1\d|2[0-4])$/.test(last)) throw new Error('Combinación de teclado no válida.');
  return keys;
}
