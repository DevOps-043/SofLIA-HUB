/**
 * Atajos de teclado del navegador integrado, con las combinaciones de Chrome.
 *
 * Es la única tabla: main la usa para reenviar las teclas que recibe la página
 * (la vista nativa se queda el foco y el renderer nunca las ve), el renderer
 * para las que llegan a su propia interfaz y los menús para mostrar la etiqueta.
 */

export type BrowserTabIndexCommand = `select-tab-${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;

export type BrowserShortcutCommand =
  | 'new-tab' | 'close-tab' | 'reopen-tab' | 'next-tab' | 'previous-tab' | BrowserTabIndexCommand | 'select-last-tab'
  | 'focus-address' | 'reload' | 'back' | 'forward'
  | 'find' | 'print' | 'zoom-in' | 'zoom-out' | 'zoom-reset' | 'fullscreen' | 'devtools'
  | 'history' | 'downloads' | 'bookmark-page' | 'bookmarks-bar' | 'bookmark-manager' | 'clear-data';

/** Teclas tal como las reporta `KeyboardEvent.key` o el `input.key` de Electron. */
export interface BrowserKeyInput {
  key: string;
  control: boolean;
  meta: boolean;
  shift: boolean;
  alt: boolean;
}

interface ShortcutBinding {
  command: BrowserShortcutCommand;
  /** Tecla en minúsculas; se aceptan alias para la misma acción. */
  keys: readonly string[];
  mod?: boolean;
  shift?: boolean;
  alt?: boolean;
}

const TAB_INDEX_BINDINGS: ShortcutBinding[] = ([1, 2, 3, 4, 5, 6, 7, 8] as const).map((index) => ({
  command: `select-tab-${index}` as BrowserTabIndexCommand,
  keys: [String(index)],
  mod: true,
}));

/** El orden importa: la primera combinación de cada comando es la que se muestra. */
const BINDINGS: readonly ShortcutBinding[] = [
  { command: 'new-tab', keys: ['t'], mod: true },
  { command: 'close-tab', keys: ['w', 'f4'], mod: true },
  { command: 'reopen-tab', keys: ['t'], mod: true, shift: true },
  { command: 'next-tab', keys: ['tab', 'pagedown'], mod: true },
  { command: 'previous-tab', keys: ['tab'], mod: true, shift: true },
  { command: 'previous-tab', keys: ['pageup'], mod: true },
  ...TAB_INDEX_BINDINGS,
  { command: 'select-last-tab', keys: ['9'], mod: true },
  { command: 'focus-address', keys: ['l'], mod: true },
  { command: 'focus-address', keys: ['d'], alt: true },
  { command: 'focus-address', keys: ['f6'] },
  { command: 'reload', keys: ['r'], mod: true },
  { command: 'reload', keys: ['f5'] },
  { command: 'back', keys: ['arrowleft'], alt: true },
  { command: 'forward', keys: ['arrowright'], alt: true },
  { command: 'find', keys: ['f'], mod: true },
  { command: 'print', keys: ['p'], mod: true },
  { command: 'zoom-in', keys: ['+', '='], mod: true },
  { command: 'zoom-in', keys: ['+', '='], mod: true, shift: true },
  { command: 'zoom-out', keys: ['-'], mod: true },
  { command: 'zoom-reset', keys: ['0'], mod: true },
  { command: 'fullscreen', keys: ['f11'] },
  { command: 'devtools', keys: ['i'], mod: true, shift: true },
  { command: 'devtools', keys: ['f12'] },
  { command: 'history', keys: ['h'], mod: true },
  { command: 'downloads', keys: ['j'], mod: true },
  { command: 'bookmark-page', keys: ['d'], mod: true },
  { command: 'bookmarks-bar', keys: ['b'], mod: true, shift: true },
  { command: 'bookmark-manager', keys: ['o'], mod: true, shift: true },
  { command: 'clear-data', keys: ['delete'], mod: true, shift: true },
];

/** Órdenes que main entrega a la interfaz: atajos y acciones de menús nativos. */
export type BrowserUiCommand = BrowserShortcutCommand | 'edit-tab-group';

export interface BrowserUiCommandRequest {
  command: BrowserUiCommand;
  /** Pestaña afectada cuando la orden sale del menú de una pestaña concreta. */
  tabId?: string;
}

const UI_COMMANDS = new Set<string>([...BINDINGS.map((binding) => binding.command), 'edit-tab-group']);

/** Comandos que escriben en la interfaz del navegador y necesitan su foco de teclado. */
const CHROME_FOCUS_COMMANDS = new Set<BrowserUiCommand>(['focus-address', 'find']);

/** Valida lo que llega por IPC antes de ejecutar nada en la interfaz. */
export function isBrowserUiCommandRequest(value: unknown): value is BrowserUiCommandRequest {
  if (!value || typeof value !== 'object') return false;
  const { command, tabId } = value as { command?: unknown; tabId?: unknown };
  return typeof command === 'string' && UI_COMMANDS.has(command)
    && (tabId === undefined || (typeof tabId === 'string' && tabId.length > 0 && tabId.length <= 80));
}

export function shortcutNeedsChromeFocus(command: BrowserUiCommand): boolean {
  return CHROME_FOCUS_COMMANDS.has(command);
}

/**
 * Resuelve la combinación pulsada. En macOS el modificador es Cmd; en el resto,
 * Ctrl. Cualquier modificador sobrante invalida el atajo para no robar
 * combinaciones propias de la página.
 */
export function resolveBrowserShortcut(input: BrowserKeyInput, platform: string): BrowserShortcutCommand | null {
  const key = input.key.toLowerCase();
  const mod = platform === 'darwin' ? input.meta : input.control;
  const extraMod = platform === 'darwin' ? input.control : input.meta;
  if (extraMod) return null;
  const match = BINDINGS.find((binding) => binding.keys.includes(key)
    && Boolean(binding.mod) === mod
    && Boolean(binding.shift) === input.shift
    && Boolean(binding.alt) === input.alt);
  return match?.command ?? null;
}

const KEY_LABELS: Record<string, string> = {
  tab: 'Tab', pagedown: 'AvPág', pageup: 'RePág', arrowleft: '←', arrowright: '→', delete: 'Supr', '=': '+',
};

/** Etiqueta legible de la combinación principal, p. ej. «Ctrl+Mayús+T». */
export function browserShortcutLabel(command: BrowserShortcutCommand, platform: string): string {
  const binding = BINDINGS.find((item) => item.command === command);
  if (!binding) return '';
  const key = binding.keys[0];
  const parts = [
    binding.mod ? (platform === 'darwin' ? '⌘' : 'Ctrl') : '',
    binding.shift ? 'Mayús' : '',
    binding.alt ? 'Alt' : '',
    KEY_LABELS[key] ?? key.toUpperCase(),
  ];
  return parts.filter(Boolean).join('+');
}

/** Acelerador de Electron equivalente, para mostrarlo en menús nativos. */
export function browserShortcutAccelerator(command: BrowserShortcutCommand): string | undefined {
  const binding = BINDINGS.find((item) => item.command === command);
  if (!binding) return undefined;
  const key = binding.keys[0];
  const parts = [
    binding.mod ? 'CmdOrCtrl' : '',
    binding.shift ? 'Shift' : '',
    binding.alt ? 'Alt' : '',
    key === '=' ? 'Plus' : key.length === 1 ? key.toUpperCase() : key.charAt(0).toUpperCase() + key.slice(1),
  ];
  return parts.filter(Boolean).join('+');
}
