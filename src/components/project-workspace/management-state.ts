import { useEffect, useRef, useState } from "react";
import type { ProjectHubResult } from "../../services/project-hub-api";
import { record, relation, type DataRecord } from "./dashboard-data";
export function userRows(value: unknown): DataRecord[] {
  return Array.isArray(value)
    ? value.map((item) => {
        const row = record(item);
        return { ...row, ...relation(row.user) };
      })
    : [];
}
export function rows(value: unknown): DataRecord[] {
  return Array.isArray(value) ? value.map(record) : [];
}
export function useProjectMutation() {
  const live = useRef(false),
    pending = useRef(false);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [uncertain, setUncertain] = useState(false);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const run = async (
    action: () => Promise<ProjectHubResult>,
    onSuccess?: () => void,
  ) => {
    if (pending.current || uncertain) return false;
    pending.current = true;
    setBusy(true);
    setMessage("");
    try {
      const result = await action();
      if (!live.current) return false;
      if (result.success) {
        onSuccess?.();
        return true;
      }
      const unknown = result.uncertain || result.recoveryRequired;
      setUncertain(Boolean(unknown));
      setMessage(
        unknown
          ? "No se pudo verificar el resultado. Vuelve a consultar los datos antes de repetir el cambio."
          : result.cancelled
            ? "Cambio cancelado."
            : result.error || "No se pudo guardar el cambio.",
      );
      return false;
    } catch {
      if (live.current) {
        setUncertain(true);
        setMessage(
          "No se pudo verificar el resultado. Vuelve a consultar los datos antes de repetir el cambio.",
        );
      }
      return false;
    } finally {
      pending.current = false;
      if (live.current) setBusy(false);
    }
  };
  return { run, busy: busy || uncertain, message, uncertain };
}
