import { useCallback, useEffect, useState } from "react";
import { projectHubApi } from "../../services/project-hub-api";
import {
  record,
  type DataRecord,
  type DataState,
  type ProjectDashboardData,
} from "./dashboard-data";

const pending = <T>(): DataState<T> => ({ loading: true, data: null });
const initial = (): ProjectDashboardData => ({
  project: pending(),
  tasks: pending(),
  evidence: pending(),
  members: pending(),
  analytics: pending(),
  milestones: pending(),
  documents: pending(),
  team: pending(),
  options: pending(),
});

export function useProjectDashboard(workspaceId: string, projectId: string) {
  const [revision, setRevision] = useState(0);
  const [snapshot, setSnapshot] = useState<{
    key: string;
    value: ProjectDashboardData;
  }>({ key: "", value: initial() });
  const key = `${workspaceId}/${projectId}/${revision}`;
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const project = await projectHubApi.getProject(workspaceId, projectId);
        if (!active) return;
        if (!project.success || !project.data) {
          setSnapshot({
            key,
            value: {
              ...initial(),
              project: {
                loading: false,
                data: null,
                error: project.error || "No se pudo abrir el proyecto.",
              },
            },
          });
          return;
        }
        setSnapshot({
          key,
          value: {
            ...initial(),
            project: { loading: false, data: project.data },
          },
        });
        const jobs = {
          tasks: () => projectHubApi.listTasks(workspaceId, projectId),
          evidence: () => projectHubApi.listEvidence(workspaceId, projectId),
          members: () => projectHubApi.listMembers(workspaceId, projectId),
          analytics: () => projectHubApi.analytics(workspaceId, projectId),
          milestones: () => projectHubApi.listMilestones({workspaceId, projectId}),
          documents: () => projectHubApi.listDocuments({workspaceId, projectId}),
          team: () => projectHubApi.getProjectTeam({workspaceId, projectId}),
          options: () => projectHubApi.getTaskOptions({workspaceId, projectId}),
        };
        await Promise.all(
          Object.entries(jobs).map(async ([resource, fetch]) => {
            try {
              const result = await fetch();
              if (!active) return;
              const data =
                ["analytics","team","options"].includes(resource)
                  ? record(result.data)
                  : Array.isArray(result.data)
                    ? result.data.map(record)
                    : null;
              const state = {
                loading: false,
                data: result.success ? data : null,
                error:
                  result.success && data !== null
                    ? undefined
                    : result.error || "No se pudo cargar este apartado.",
                partial: result.meta?.has_more === true,
              };
              setSnapshot((current) =>
                current.key === key
                  ? { key, value: { ...current.value, [resource]: state } }
                  : current,
              );
            } catch {
              if (active)
                setSnapshot((current) =>
                  current.key === key
                    ? {
                        key,
                        value: {
                          ...current.value,
                          [resource]: {
                            loading: false,
                            data: null,
                            error: "No se pudo cargar este apartado.",
                          },
                        },
                      }
                    : current,
                );
            }
          }),
        );
      } catch {
        if (active)
          setSnapshot({
            key,
            value: {
              ...initial(),
              project: {
                loading: false,
                data: null,
                error: "No se pudo abrir el proyecto.",
              },
            },
          });
      }
    })();
    return () => {
      active = false;
    };
  }, [key, projectId, workspaceId]);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  const value = snapshot.key === key ? snapshot.value : initial();
  return { ...value, reload };
}
export type DashboardModel = ReturnType<typeof useProjectDashboard>;
export function resourceRows(data: DataRecord[] | null, kind: "files" | "web") {
  return (data || []).filter((row) =>
    kind === "files"
      ? ["upload", "drive_file"].includes(String(row.evidence_type))
      : ["link", "browser_collection"].includes(String(row.evidence_type)),
  );
}
