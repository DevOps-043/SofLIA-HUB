export interface DirEntry {
  name: string;
  isDir: boolean;
  size?: number;
  mtime?: number;
}

export interface ScannedDir {
  path: string;
  label: string;
  entries: DirEntry[];
  lastScanMs: number;
}
