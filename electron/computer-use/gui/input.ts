import { computerGuiInput, computerInputSnapshot } from '../../../src/shared/computer-use-input';
import { windowsVirtualKey } from '../../desktop-agent/windows-hotkey';
import { GuiFailure } from './execution-context';

export type GuiInput = ReturnType<typeof parseGuiInput>;
export function parseGuiInput(value: unknown) {
  try {
    const [snapshot] = computerInputSnapshot([value]);
    const parsed = computerGuiInput.parse(snapshot);
    if (parsed.text && Array.from(parsed.text).some(character => { const code = character.charCodeAt(0); return code === 127 || code < 32 && ![9, 10, 13].includes(code); })) throw new GuiFailure('GUI_INVALID_INPUT');
    return parsed;
  } catch { throw new GuiFailure('GUI_INVALID_INPUT'); }
}
const aliases: Readonly<Record<string, string>> = {
  control: 'ctrl', control_l: 'ctrl', control_r: 'ctrl', cmd: 'meta', command: 'meta', win: 'meta', super: 'meta',
  option: 'alt', alt_l: 'alt', alt_r: 'alt', shift_l: 'shift', shift_r: 'shift',
  return: 'enter', esc: 'escape', del: 'delete', page_up: 'pageup', page_down: 'pagedown', pgup: 'pageup', pgdn: 'pagedown',
};
/** Una tecla o acorde cerrado. Conserva aliases SendKeys simples, sin secuencias. */
export function parseGuiKeys(input: string): string[] {
  if (input.length > 160 || !input.trim()) throw new GuiFailure('GUI_INVALID_INPUT');
  let value = input.trim();
  if (/^[\^%+]*\{?[a-zA-Z0-9]+\}?$/.test(value) && /^[\^%+{]/.test(value)) {
    const prefix = value.match(/^[\^%+]*/)?.[0] ?? '';
    const key = value.slice(prefix.length).replace(/^\{([^{}]+)\}$/, '$1');
    value = [...Array.from(prefix).map(character => ({ '^': 'ctrl', '%': 'alt', '+': 'shift' })[character]), key].join('+');
  }
  const keys = value.toLowerCase().split('+').map(key => aliases[key] ?? key);
  if (keys.length > 5 || keys.some(key => !key) || new Set(keys).size !== keys.length) throw new GuiFailure('GUI_INVALID_INPUT');
  const modifiers = new Set(['ctrl', 'alt', 'shift', 'meta']);
  if (keys.slice(0, -1).some(key => !modifiers.has(key)) || keys.length > 1 && modifiers.has(keys[keys.length - 1])) throw new GuiFailure('GUI_INVALID_INPUT');
  try { keys.forEach(windowsVirtualKey); } catch { throw new GuiFailure('GUI_INVALID_INPUT'); }
  return keys;
}
/** SendKeys sólo recibe texto escapado; key usa códigos numéricos cerrados. */
export function windowsLiteralText(text: string): string {
  return Array.from(text.replace(/\r\n/g, '\n')).map(character => {
    if (character === '\n' || character === '\r') return '{ENTER}';
    if (character === '\t') return '{TAB}';
    return '+^%~(){}[]'.includes(character) ? `{${character}}` : character;
  }).join('');
}
