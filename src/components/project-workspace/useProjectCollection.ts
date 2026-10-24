import { useCallback, useEffect, useRef, useState } from "react";
import type { ProjectHubResult } from "../../services/project-hub-api";
import { record, type DataRecord, type DataState } from "./dashboard-data";

/** Clave explícita de ámbito/filtros: una respuesta tardía nunca se mezcla con otra página. */
export function useProjectCollection(
  key: string,
  fetchPage: (cursor?: string) => Promise<ProjectHubResult>,
  idField: string,
) {
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;
  const generation = useRef({ active: false }),
    moreBusy = useRef(false);
  const [revision, setRevision] = useState(0);
  const scope = key + "/" + revision;
  const [snapshot, setSnapshot] = useState<{
    key: string;
    state: DataState<DataRecord[]>;
    cursor?: string;
    moreLoading?: boolean;
  }>({ key: "", state: { loading: true, data: null } });
  useEffect(() => {
    const current = { active: true };
    generation.current = current;
    moreBusy.current = false;
    const fetchCurrent = fetchRef.current;
    void Promise.resolve()
      .then(() => fetchCurrent())
      .then((result) => {
        if (!current.active) return;
        const valid = result.success && Array.isArray(result.data);
        setSnapshot({
          key: scope,
          state: {
            loading: false,
            data: valid ? (result.data as unknown[]).map(record) : null,
            error: valid
              ? undefined
              : result.error || "No se pudo cargar este apartado.",
          },
          cursor: result.meta?.next_cursor || undefined,
        });
      })
      .catch(() => {
        if (current.active)
          setSnapshot({
            key: scope,
            state: {
              loading: false,
              data: null,
              error: "No se pudo cargar este apartado.",
            },
          });
      });
    return () => {
      current.active = false;
    };
  }, [scope]);
  const more = async () => {
    if (snapshot.key !== scope || !snapshot.cursor || moreBusy.current) return;
    const current = generation.current,
      cursor = snapshot.cursor;
    moreBusy.current = true;
    setSnapshot((value) => ({ ...value, moreLoading: true }));
    try {
      const result = await fetchRef.current(cursor);
      if (current !== generation.current) return;
      if (!result.success || !Array.isArray(result.data))
        throw new Error(
          result.error || "No se pudo cargar la siguiente página.",
        );
      setSnapshot((value) => {
        const rows = new Map(
          (value.state.data || []).map((row) => [row[idField], row]),
        );
        for (const row of (result.data as unknown[]).map(record))
          rows.set(row[idField], row);
        return {
          key: scope,
          state: { loading: false, data: [...rows.values()] },
          cursor: result.meta?.next_cursor || undefined,
          moreLoading: false,
        };
      });
    } catch (error) {
      if (current === generation.current)
        setSnapshot((value) => ({
          ...value,
          moreLoading: false,
          state: {
            ...value.state,
            error:
              error instanceof Error
                ? error.message
                : "No se pudo cargar la siguiente página.",
          },
        }));
    } finally {
      if (current === generation.current) moreBusy.current = false;
    }
  };
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  return {
    state:
      snapshot.key === scope ? snapshot.state : { loading: true, data: null },
    hasMore: snapshot.key === scope && Boolean(snapshot.cursor),
    moreLoading: snapshot.key === scope && snapshot.moreLoading,
    more,
    reload,
  };
}
