import { useCallback, useEffect, useRef, useState } from "react";
import type { UpdaterStatus } from "../../services/updater-service";
import { installUpdate } from "../../services/updater-service";
import { APP_VERSION } from "../../shared/app-version";

const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "No se pudo consultar el servicio de actualizaciones.";
const boundedProgress = (value: number) =>
  Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;

export function useUpdatePanel() {
  const [status, setStatus] = useState<UpdaterStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const mounted = useRef(false);
  const request = useRef(0);
  const busy = useRef(false);
  const isAvailable = typeof window.updater !== "undefined";
  const patch = useCallback((next: Partial<UpdaterStatus>) => {
    if (!mounted.current) return;
    request.current += 1;
    setStatus((current) => ({
      state: "idle",
      currentVersion: APP_VERSION,
      availableVersion: null,
      releaseNotes: null,
      downloadProgress: null,
      error: null,
      ...current,
      ...next,
    }));
  }, []);

  useEffect(() => {
    mounted.current = true;
    if (!isAvailable)
      return () => {
        mounted.current = false;
      };
    const bridge = window.updater;
    const id = ++request.current;
    void bridge
      .getStatus()
      .then((value) => {
        if (mounted.current && id === request.current) setStatus(value);
      })
      .catch((reason: unknown) => {
        if (mounted.current && id === request.current)
          setError(errorMessage(reason));
      });
    const unsubscribers = [
      bridge.onUpdateAvailable((info) => {
        if (!mounted.current) return;
        setError(null);
        patch({
          state: "available",
          availableVersion: info.version,
          releaseNotes: info.releaseNotes,
          error: null,
        });
      }),
      bridge.onDownloadProgress((info) =>
        patch({
          state: "downloading",
          downloadProgress: boundedProgress(info.percent),
        }),
      ),
      bridge.onUpdateDownloaded((info) =>
        patch({
          state: "downloaded",
          availableVersion: info.version,
          releaseNotes: info.releaseNotes,
          downloadProgress: 100,
        }),
      ),
      bridge.onError((info) => {
        if (mounted.current) setError(info.message);
        patch({ state: "error", error: info.message });
      }),
    ];
    return () => {
      mounted.current = false;
      request.current += 1;
      unsubscribers.forEach((unsubscribe) => {
        if (typeof unsubscribe === "function") unsubscribe();
      });
    };
  }, [isAvailable, patch]);

  const handleCheck = useCallback(async () => {
    if (!isAvailable || busy.current) return;
    busy.current = true;
    setChecking(true);
    setError(null);
    try {
      const response = await window.updater.checkForUpdates();
      if (!response.success)
        throw new Error(
          response.error || "No se pudieron buscar actualizaciones.",
        );
      const id = ++request.current;
      const value = await window.updater.getStatus();
      if (!mounted.current || id !== request.current) return;
      setStatus(value);
      if (value.state === "error")
        setError(value.error || "No se pudieron buscar actualizaciones.");
      if (
        value.state === "not-available" ||
        value.state === "available" ||
        value.state === "downloaded"
      )
        setLastCheckedAt(new Date());
    } catch (reason) {
      if (mounted.current) setError(errorMessage(reason));
      patch({ state: "error" });
    } finally {
      busy.current = false;
      if (mounted.current) setChecking(false);
    }
  }, [isAvailable, patch]);

  const handleDownload = useCallback(async () => {
    if (!isAvailable || busy.current) return;
    busy.current = true;
    setError(null);
    patch({ state: "downloading", downloadProgress: 0 });
    try {
      const response = await window.updater.downloadUpdate();
      if (!response.success)
        throw new Error(
          response.error || "No se pudo descargar la actualización.",
        );
    } catch (reason) {
      if (mounted.current) setError(errorMessage(reason));
      patch({ state: "error" });
    } finally {
      busy.current = false;
    }
  }, [isAvailable, patch]);

  const handleInstall = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    try {
      await installUpdate();
    } catch (reason) {
      if (mounted.current) setError(errorMessage(reason));
    } finally {
      busy.current = false;
    }
  }, []);

  return {
    status,
    checking,
    error,
    lastCheckedAt,
    isAvailable,
    state: status?.state ?? "idle",
    currentVersion: status?.currentVersion || APP_VERSION,
    availableVersion: status?.availableVersion,
    notes: status?.releaseNotes,
    progress: boundedProgress(status?.downloadProgress ?? 0),
    handleCheck,
    handleDownload,
    handleInstall,
  };
}
