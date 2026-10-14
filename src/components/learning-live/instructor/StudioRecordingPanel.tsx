import { useCallback, useEffect, useRef, useState } from "react";
import {
  studioOperation,
  onStudioInvalidation,
} from "../../../services/live-studio-service";
import type { LearningLiveSessionReference } from "../../../shared/learning-live-session";
import type { RecordingSnapshot } from "../../../shared/recordings.contract";
const labels: Record<string, string> = {
  recording: "Grabando",
  interrupted: "Interrumpida",
  processing: "Procesando",
  importing: "Guardando en Soflia",
  ready: "Guardada en Soflia",
  failed: "Requiere revisión",
  missing: "Sin vídeo disponible",
  purging: "Retirando",
  purged: "Archivo retirado",
};
export function StudioRecordingPanel({
  reference,
  sdkStatus,
}: {
  reference: LearningLiveSessionReference;
  sdkStatus: string;
}) {
  const [data, setData] = useState<RecordingSnapshot | null>(null),
    [error, setError] = useState("");
  const alive = useRef(false),
    pending = useRef(false),
    dirty = useRef(false);
  const slug = reference.organization_slug,
    session = reference.session_id;
  const refresh = useCallback(async () => {
    if (pending.current) {
      dirty.current = true;
      return;
    }
    pending.current = true;
    try {
      do {
        dirty.current = false;
        const result = await studioOperation(
          { organization_slug: slug, session_id: session },
          { type: "recordings", operation: { type: "snapshot" } },
        );
        if (!alive.current) return;
        if (
          result.success &&
          result.recording_snapshot &&
          result.recording_snapshot.session_id === session
        ) {
          setData(result.recording_snapshot);
          setError("");
        } else
          setError(
            result.success
              ? "No se confirmó el archivo de grabación."
              : result.error,
          );
      } while (dirty.current);
    } finally {
      pending.current = false;
    }
  }, [slug, session]);
  useEffect(() => {
    alive.current = true;
    const off = onStudioInvalidation(session, (status) => {
      if (status !== "disconnected") void refresh();
    });
    void Promise.resolve().then(refresh);
    return () => {
      alive.current = false;
      off();
    };
  }, [session, refresh]);
  const latest = data?.runs[0];
  const recording =
    sdkStatus === "Recording" ||
    (sdkStatus === "unknown" && latest?.status === "recording");
  return (
    <section
      className="studio-recording-panel"
      aria-label="Grabación de la sesión"
    >
      <div>
        <span className="studio-eyebrow">GRABACIÓN AUTOMÁTICA</span>
        <strong role="status">
          {recording
            ? "Grabando"
            : latest &&
                ["ready", "failed", "missing", "purging", "purged"].includes(
                  latest.status,
                )
              ? labels[latest.status]
              : sdkStatus === "Paused" || sdkStatus === "Stopped"
                ? "Grabación interrumpida"
                : latest
                  ? labels[latest.status]
                  : data?.availability === "missing"
                    ? "Grabación sin confirmar"
                    : "Esperando confirmación de grabación"}
        </strong>
        <p>
          El vídeo se guarda de forma privada en Soflia.
        </p>
      </div>
      {error && (
        <p role="alert">
          {error}
          <button onClick={() => void refresh()}>Reintentar</button>
        </p>
      )}
    </section>
  );
}
