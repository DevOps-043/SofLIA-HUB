export const MAX_APP_SEARCH_RESULTS = 16;
export const MAX_APP_SEARCH_DIRS = 2500;

export const WINDOWS_APP_ALIASES: Record<string, string[]> = {
  anydesk: ['AnyDesk.exe'],
  calculadora: ['calc.exe'],
  calculator: ['calc.exe'],
  blocdenotas: ['notepad.exe'],
  notepad: ['notepad.exe'],
  explorer: ['explorer.exe'],
  fileexplorer: ['explorer.exe'],
  chrome: ['chrome.exe'],
  edge: ['msedge.exe'],
  brave: ['brave.exe'],
  whatsapp: ['WhatsApp.exe'],
  vscode: ['Code.exe'],
  code: ['Code.exe'],
  visualstudiocode: ['Code.exe'],
  word: ['WINWORD.EXE'],
  excel: ['EXCEL.EXE'],
  powerpoint: ['POWERPNT.EXE'],
  outlook: ['OUTLOOK.EXE'],
  teams: ['Teams.exe', 'ms-teams.exe'],
  zoom: ['Zoom.exe'],
};

export const SKIP_DIR_NAMES = new Set([
  'windows',
  'winsxs',
  'system32',
  'syswow64',
  'node_modules',
  '.git',
]);
