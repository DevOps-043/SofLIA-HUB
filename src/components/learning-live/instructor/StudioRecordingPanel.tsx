import { useCallback, useEffect, useRef, useState } from "react";
import { useStudioRuntime } from "./StudioRuntimeContext";
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
  const runtime = useStudioRuntime();
  const [data, setData] = useState<RecordingSnapshot | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
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
  async function change(requested: boolean) {
    if (!data || busy) return;
    setBusy(true);
    const result = await studioOperation(reference, {
      type: "recordings",
      operation: { type: "intent", revision: data.revision, requested },
    });
    if (alive.current) {
      if (
        result.success &&
        result.recording_snapshot &&
        result.recording_snapshot.session_id === session
      )
        setData(result.recording_snapshot);
      else
        setError(
          result.success ? "No se confirmó la preferencia." : result.error,
        );
      setBusy(false);
    }
  }
  const latest = data?.runs[0];
  const recording =
    sdkStatus === "Recording" ||
    (sdkStatus === "unknown" && latest?.status === "recording");
  return (
    <section
      className="studio-recording-panel"
      aria-label="Grabación del webinar"
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
                    : "Esperando confirmación de Zoom"}
        </strong>
        <p>
          El vídeo se guarda privado en Soflia. No necesitas una cuenta
          individual de Zoom.
        </p>
      </div>
      {runtime?.snapshot.can_manage && data?.can_manage && (
        <label>
          <input
            type="checkbox"
            checked={data.requested}
            disabled={busy}
            onChange={(event) => void change(event.target.checked)}
          />
          Permitir ver después en Learning
        </label>
      )}
      {error && (
        <p role="alert">
          {error}
          <button onClick={() => void refresh()}>Reintentar</button>
        </p>
      )}
    </section>
  );
}
