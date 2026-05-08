export const MAX_FILE_READ_SIZE = 1 * 1024 * 1024;
export const MAX_SEARCH_RESULTS = 200;
export const MAX_SEARCH_DEPTH = 8;

export const SEARCH_SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'AppData',
  '$Recycle.Bin',
  'dist',
  'dist-electron',
]);
