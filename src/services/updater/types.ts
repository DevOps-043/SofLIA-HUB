export type UpdaterState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface UpdaterStatus {
  state: UpdaterState;
  currentVersion: string;
  availableVersion: string | null;
  releaseNotes: string | null;
  downloadProgress: number | null;
  error: string | null;
}

export interface UpdateAvailableInfo {
  version: string;
  releaseNotes: string | null;
  releaseDate: string;
}

export interface DownloadProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}
