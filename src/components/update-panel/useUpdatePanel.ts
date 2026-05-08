import { useCallback, useEffect, useState } from 'react';
import type { DownloadProgress, UpdateAvailableInfo, UpdaterStatus } from '../../services/updater-service';

export function useUpdatePanel() {
  const [status, setStatus] = useState<UpdaterStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [version, setVersion] = useState('');
  const [releaseNotes, setReleaseNotes] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window.updater === 'undefined') return;

    window.updater.getStatus().then(setStatus);
    window.updater.onUpdateAvailable((info: UpdateAvailableInfo) => {
      setVersion(info.version);
      setReleaseNotes(info.releaseNotes);
      setChecking(false);
      setStatus(prev => prev ? { ...prev, state: 'available', availableVersion: info.version, releaseNotes: info.releaseNotes } : prev);
    });
    window.updater.onDownloadProgress((prog: DownloadProgress) => {
      setProgress(prog.percent);
      setStatus(prev => prev ? { ...prev, state: 'downloading', downloadProgress: prog.percent } : prev);
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
  }, []);

  const handleCheck = useCallback(async () => {
    if (typeof window.updater === 'undefined') return;
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
  }, []);

  const handleDownload = useCallback(async () => {
    if (typeof window.updater === 'undefined') return;
    setProgress(0);
    await window.updater.downloadUpdate();
  }, []);

  const handleInstall = useCallback(() => {
    if (typeof window.updater !== 'undefined') window.updater.installUpdate();
  }, []);

  return {
    status,
    checking,
    progress,
    error,
    state: status?.state || 'idle',
    currentVersion: status?.currentVersion || '0.0.0',
    availableVersion: version || status?.availableVersion,
    notes: releaseNotes || status?.releaseNotes,
    handleCheck,
    handleDownload,
    handleInstall,
  };
}
