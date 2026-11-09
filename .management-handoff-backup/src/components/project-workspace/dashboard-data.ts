import type { ProjectHubProject } from "../../services/project-hub-api";

export type DataState<T> = {
  loading: boolean;
  data: T | null;
  error?: string;
  partial?: boolean;
};
export type DataRecord = Record<string, unknown>;
export interface ProjectDashboardData {
  project: DataState<ProjectHubProject>;
  tasks: DataState<DataRecord[]>;
  evidence: DataState<DataRecord[]>;
  members: DataState<DataRecord[]>;
  analytics: DataState<DataRecord>;
}
export const record = (value: unknown): DataRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as DataRecord)
    : {};
export const relation = (value: unknown) =>
  record(Array.isArray(value) ? value[0] : value);
export const text = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;
export const count = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
export function dateLabel(value: unknown) {
  const raw = text(value);
  if (!raw) return "Sin fecha";
  const date = new Date(raw.length === 10 ? `${raw}T12:00:00` : raw);
  return Number.isNaN(date.getTime())
    ? "Sin fecha"
    : date.toLocaleDateString("es-MX", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}
export function projectProgress(analytics: DataRecord | null) {
  const tasks = record(analytics?.tasks);
  const total = count(tasks.total);
  const completed = count(tasks.completed);
  if (total === null || completed === null || completed > total) return null;
  return total
    ? { total, completed, percent: Math.round((completed / total) * 100) }
    : { total: 0, completed: 0, percent: null };
}
export const projectStatus = (value: string) =>
  ({
    planning: "Planeación",
    active: "En curso",
    on_hold: "En pausa",
    completed: "Completado",
    cancelled: "Cancelado",
    archived: "Archivado",
  })[value] || "Estado no disponible";
