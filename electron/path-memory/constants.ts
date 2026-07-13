export const SCAN_INTERVAL_MS = 15 * 60 * 1000;
export const WATCH_DEBOUNCE_MS = 5000;
export const MAX_ENTRIES_PER_DIR = 200;
export const MAX_DEPTH = 4;
export const MAX_PATHS_MD_SIZE = 8000;

export const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  '.vscode',
  '.idea',
  '__pycache__',
  'AppData',
  '$Recycle.Bin',
  'Program Files',
  'Program Files (x86)',
  'Windows',
  'ProgramData',
  'Recovery',
  'System Volume Information',
  'MSOCache',
  'Intel',
  'PerfLogs',
  'All Users',
]);

export const EXCLUDED_PREFIXES = ['.', '$'];

// Respaldo cuando el SO no declara la ruta: nombres de carpeta habituales en
// Windows, macOS y Linux (incluye acentos, que Linux localizado si usa).
export const KEY_FOLDER_VARIANTS: Record<string, string[]> = {
  Escritorio: ['Desktop', 'Escritorio'],
  Documentos: ['Documents', 'Documentos'],
  Descargas: ['Downloads', 'Descargas'],
  Imagenes: ['Pictures', 'Imagenes', 'Imágenes'],
  Musica: ['Music', 'Musica', 'Música'],
  Videos: ['Videos', 'Vídeos', 'Movies'],
};
