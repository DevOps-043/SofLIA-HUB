import { TextField } from "../ui/TextField";
import { useState } from "react";
import { projectHubApi } from "../../services/project-hub-api";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import {
  dateLabel,
  relation,
  text,
  type DataRecord,
  type DataState,
} from "./dashboard-data";

export function ProjectTasks({
  workspaceId,
  projectId,
  state,
  canWrite,
  onRefresh,
}: {
  workspaceId: string;
  projectId: string;
  state: DataState<DataRecord[]>;
  canWrite: boolean;
  onRefresh: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const create = async () => {
    if (!canWrite || !title.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await projectHubApi.createTask(workspaceId, projectId, {
        title: title.trim(),
      });
      if (!result.success)
        setError(result.error || "No se pudo crear la tarea.");
      else {
        setAdding(false);
        setTitle("");
        onRefresh();
      }
    } catch {
      setError("No se pudo crear la tarea.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Tareas</h2>
        {canWrite && (
          <Button size="sm" onClick={() => setAdding(!adding)}>
            Nueva tarea
          </Button>
        )}
      </div>
      {adding && (
        <Card>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
            className="space-y-3"
          >
            <label className="block text-sm">
              Título de la tarea
              <TextField
                required
                maxLength={500}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-border bg-surface-2 px-3 py-2"
              />
            </label>
            <div className="flex gap-2">
              <Button type="submit" size="sm" loading={busy}>
                Crear tarea
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setAdding(false)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {state.loading ? (
        <p className="text-sm text-secondary">Cargando tareas…</p>
      ) : state.error ? (
        <Card>
          <p className="text-sm text-secondary">{state.error}</p>
          <Button size="sm" variant="ghost" onClick={onRefresh}>
            Reintentar
          </Button>
        </Card>
      ) : !state.data?.length ? (
        <Card>
          <p className="text-sm text-secondary">Aún no hay tareas visibles.</p>
        </Card>
      ) : (
        <Card padded={false}>
          <div className="divide-y divide-border">
            {state.data.map((task) => (
              <div
                key={text(task.issue_id)}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {text(task.title, "Sin título")}
                  </p>
                  <p className="mt-1 text-xs text-secondary">
                    {text(relation(task.assignee).display_name, "Sin asignar")}{" "}
                    · {dateLabel(task.due_date)}
                  </p>
                </div>
                <span className="rounded-full bg-surface-2 px-3 py-1 text-xs text-secondary">
                  {text(relation(task.task_statuses).name, "Sin estado")}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
      {state.partial && (
        <p className="text-xs text-secondary">
          Vista parcial: hay más tareas en el servidor.
        </p>
      )}
    </div>
  );
}
