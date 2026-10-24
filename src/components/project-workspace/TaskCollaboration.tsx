import { useEffect, useState } from "react";
import { projectHubApi } from "../../services/project-hub-api";
import { Button } from "../ui/Button";
import { TextArea } from "../ui/TextArea";
import {
  dateLabel,
  record,
  relation,
  text,
  type DataRecord,
} from "./dashboard-data";
import { MutationNotice } from "./ManagementControls";
import { rows, useProjectMutation } from "./management-state";
import { ProjectDocuments } from "./ProjectDocuments";

const historyLabels: Record<string, string> = {
  created: "Tarea creada",
  title: "Título actualizado",
  description: "Descripción actualizada",
  status_id: "Estado actualizado",
  priority_id: "Prioridad actualizada",
  assignee_id: "Responsable actualizado",
  due_date: "Fecha límite actualizada",
  cycle_id: "Ciclo actualizado",
  parent_issue_id: "Tarea principal actualizada",
  estimate_points: "Estimación en puntos actualizada",
  estimate_hours: "Estimación en horas actualizada",
  labels: "Etiquetas actualizadas",
  comment: "Comentario añadido",
};
export function TaskCollaboration({
  workspaceId,
  projectId,
  taskId,
  canWrite,
  canManage,
  onOpenWeb,
}: {
  workspaceId: string;
  projectId: string;
  taskId: string;
  canWrite: boolean;
  canManage: boolean;
  onOpenWeb?: (url: string) => void;
}) {
  const [revision, setRevision] = useState(0),
    [state, setState] = useState<{
      loading: boolean;
      data: DataRecord;
      error?: string;
    }>({ loading: true, data: {} }),
    [comment, setComment] = useState("");
  const mutation = useProjectMutation();
  useEffect(() => {
    let active = true;
    void projectHubApi
      .getTaskDetail({ workspaceId, projectId, taskId })
      .then((result) => {
        if (active)
          setState({
            loading: false,
            data: record(result.data),
            error: result.success
              ? undefined
              : result.error || "No se pudo cargar la actividad de la tarea.",
          });
      })
      .catch(() => {
        if (active)
          setState({
            loading: false,
            data: {},
            error: "No se pudo cargar la actividad de la tarea.",
          });
      });
    return () => {
      active = false;
    };
  }, [workspaceId, projectId, taskId, revision]);
  return (
    <div className="mt-5 space-y-5 border-t border-border pt-5">
      <section className="space-y-3" aria-label="Comentarios de la tarea">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold">Comentarios</h3>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setRevision((value) => value + 1)}
          >
            Actualizar comentarios
          </Button>
        </div>
        {state.loading ? (
          <p className="text-sm text-secondary">Cargando actividad…</p>
        ) : state.error ? (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        ) : rows(state.data.comments).length ? (
          rows(state.data.comments).map((row) => (
            <article
              key={text(row.comment_id)}
              className="rounded-2xl border border-border p-3"
            >
              <p className="text-xs text-secondary">
                {text(relation(row.author).display_name, "Colaborador")} ·{" "}
                {dateLabel(row.created_at)}
              </p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                {text(row.body)}
              </p>
            </article>
          ))
        ) : (
          <p className="text-sm text-secondary">Aún no hay comentarios.</p>
        )}
        <MutationNotice message={mutation.message} />
        {canWrite && (
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              void mutation.run(
                () =>
                  projectHubApi.addTaskComment({
                    workspaceId,
                    projectId,
                    taskId,
                    content: comment.trim(),
                  }),
                () => {
                  setComment("");
                  setRevision((value) => value + 1);
                },
              );
            }}
          >
            <TextArea
              label="Nuevo comentario"
              id={"task-comment-" + taskId}
              maxLength={20000}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={3}
            />
            <Button
              size="sm"
              type="submit"
              disabled={!comment.trim() || mutation.busy}
            >
              Publicar comentario
            </Button>
          </form>
        )}
      </section>
      <ProjectDocuments
        workspaceId={workspaceId}
        projectId={projectId}
        taskId={taskId}
        canWrite={canWrite}
        canManage={canManage}
        onRefresh={() => setRevision((value) => value + 1)}
        onOpenWeb={onOpenWeb}
      />
      <section aria-label="Historial de la tarea">
        <h3 className="mb-3 font-semibold">Actividad de la tarea</h3>
        {rows(state.data.history).length ? (
          rows(state.data.history).map((row) => (
            <div
              key={text(row.history_id)}
              className="border-b border-border py-2"
            >
              <p className="text-sm">
                {historyLabels[text(row.field_name)] || "Tarea actualizada"}
              </p>
              <p className="mt-1 text-xs text-secondary">
                {text(relation(row.actor).display_name, "Colaborador")} ·{" "}
                {dateLabel(row.created_at)}
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm text-secondary">
            {state.error
              ? "Actividad no disponible."
              : "Sin cambios registrados."}
          </p>
        )}
      </section>
    </div>
  );
}
