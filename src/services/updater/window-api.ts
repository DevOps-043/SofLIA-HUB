import type { DownloadProgress, UpdateAvailableInfo, UpdaterState, UpdaterStatus } from './types';

declare global {
  interface Window {
    updater: {
      checkForUpdates: () => Promise<{ success: boolean; state?: UpdaterState; availableVersion?: string | null; error?: string }>;
      downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
      installUpdate: () => Promise<{ success: boolean; error?: string }>;
      getStatus: () => Promise<UpdaterStatus>;
      onUpdateAvailable: (cb: (info: UpdateAvailableInfo) => void) => void;
      onDownloadProgress: (cb: (progress: DownloadProgress) => void) => void;
      onUpdateDownloaded: (cb: (info: { version: string; releaseNotes: string | null }) => void) => void;
      onError: (cb: (err: { message: string }) => void) => void;
      removeListeners: () => void;
    };
  }
}

export {};
