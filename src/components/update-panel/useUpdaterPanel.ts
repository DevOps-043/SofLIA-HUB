import { useCallback, useEffect, useState } from 'react';
import type { DownloadProgress, UpdaterStatus, UpdateAvailableInfo } from '../../services/updater-service';

export function useUpdaterPanel() {
  const [status, setStatus] = useState<UpdaterStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [version, setVersion] = useState('');
  const [releaseNotes, setReleaseNotes] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const isAvailable = typeof window.updater !== 'undefined';

  useEffect(() => {
    if (!isAvailable) return;
    window.updater.getStatus().then(setStatus);
    window.updater.onUpdateAvailable((info: UpdateAvailableInfo) => {
      setVersion(info.version);
      setReleaseNotes(info.releaseNotes);
      setChecking(false);
      setStatus(prev => prev ? {
        ...prev,
        state: 'available',
        availableVersion: info.version,
        releaseNotes: info.releaseNotes,
      } : prev);
    });
    window.updater.onDownloadProgress((download: DownloadProgress) => {
      setProgress(download.percent);
      setStatus(prev => prev ? { ...prev, state: 'downloading', downloadProgress: download.percent } : prev);
    });
    window.updater.onUpdateDownloaded(() => {
      setStatus(prev => prev ? { ...prev, state: 'downloaded', downloadProgress: 100 } : prev);
    });
    window.updater.onError((err) => {
      setError(err.message);
      setChecking(false);
      setStatus(prev => prev ? { ...prev, state: 'error', error: err.message } : prev);
    });
    return () => window.updater.removeListeners();
  }, [isAvailable]);

  const handleCheck = useCallback(async () => {
    if (!isAvailable) return;
    setChecking(true);
    setError(null);
    try {
      const result = await window.updater.checkForUpdates();
      if (!result.success) return;
      const nextStatus = await window.updater.getStatus();
      setStatus(nextStatus);
      if (nextStatus.state === 'not-available') setChecking(false);
    } catch (err: any) {
      setError(err.message);
      setChecking(false);
    }
  }, [isAvailable]);

  const handleDownload = useCallback(async () => {
    if (!isAvailable) return;
    setProgress(0);
    await window.updater.downloadUpdate();
  }, [isAvailable]);

  const handleInstall = useCallback(() => {
    if (isAvailable) window.updater.installUpdate();
  }, [isAvailable]);

  return {
    availableVersion: version || status?.availableVersion,
    checking,
    currentVersion: status?.currentVersion || '0.0.0',
    error,
    handleCheck,
    handleDownload,
    handleInstall,
    isAvailable,
    notes: releaseNotes || status?.releaseNotes,
    progress,
    state: status?.state || 'idle',
    status,
  };
}
