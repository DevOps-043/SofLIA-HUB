export type {
  DownloadProgress,
  UpdateAvailableInfo,
  UpdaterState,
  UpdaterStatus,
} from './updater/types';
export {
  checkForUpdates,
  downloadUpdate,
  getUpdaterStatus,
  installUpdate,
} from './updater/api';
import './updater/window-api';
