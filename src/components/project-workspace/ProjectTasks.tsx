import { TaskCollaboration } from "./TaskCollaboration";
import { useEffect, useState } from "react";
import { projectHubApi } from "../../services/project-hub-api";
import type { ProjectHubInputs } from "../../shared/project-hub";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { TextField } from "../ui/TextField";
import {
  dateLabel,
  record,
  relation,
  text,
  type DataRecord,
  type DataState,
} from "./dashboard-data";
import {
  Choice,
  Field,
  fieldClass,
  MoreButton,
  MutationNotice,
} from "./ManagementControls";
import { rows, userRows, useProjectMutation } from "./management-state";
import { useProjectCollection } from "./useProjectCollection";

type Draft = {
  title: string;
  description: string;
  status_id: string;
  priority_id: string;
  assignee_id: string;
  due_date: string;
  cycle_id: string;
  parent_issue_id: string;
  estimate_points: string;
  estimate_hours: string;
};
const empty: Draft = {
  title: "",
  description: "",
  status_id: "",
  priority_id: "",
  assignee_id: "",
  due_date: "",
  cycle_id: "",
  parent_issue_id: "",
  estimate_points: "",
  estimate_hours: "",
};
export function ProjectTasks({
  workspaceId,
  projectId,
  canWrite,
  canManage = false,
  onRefresh,
  onOpenWeb,
}: {
  workspaceId: string;
  projectId: string;
  state: DataState<DataRecord[]>;
  canWrite: boolean;
  canManage?: boolean;
  onRefresh: () => void;
  onOpenWeb?: (url: string) => void;
}) {
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [assignee, setAssignee] = useState(""),
    [priority, setPriority] = useState(""),
    [cycle, setCycle] = useState("");
  const filters = {
    search: search.trim() || undefined,
    statusId: status || undefined,
    assigneeId: assignee || undefined,
    priorityId: priority || undefined,
    cycleId: cycle || undefined,
  };
  const list = useProjectCollection(
    JSON.stringify([workspaceId, projectId, filters]),
    (cursor) =>
      projectHubApi.listTasks(workspaceId, projectId, { ...filters, cursor }),
    "issue_id",
  );
  const [options, setOptions] = useState<DataRecord>({}),
    [optionError, setOptionError] = useState(""),
    [optionRevision, setOptionRevision] = useState(0);
  const [editing, setEditing] = useState<DataRecord | null>(null),
    [draft, setDraft] = useState<Draft>(empty),
    [archiving, setArchiving] = useState(false);
  const [labels, setLabels] = useState<string[]>([]),
    [labelName, setLabelName] = useState("");
  const mutation = useProjectMutation();
  useEffect(() => {
    let active = true;
    void projectHubApi
      .getTaskOptions({ workspaceId, projectId })
      .then((result) => {
        if (active) {
          setOptions(record(result.data));
          setOptionError(
            result.success
              ? ""
              : result.error ||
                  "No se pudieron cargar los estados y responsables.",
          );
        }
      })
      .catch(() => {
        if (active)
          setOptionError("No se pudieron cargar los estados y responsables.");
      });
    return () => {
      active = false;
    };
  }, [workspaceId, projectId, optionRevision]);
  const field = (key: keyof Draft) => (value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const edit = (task: DataRecord) => {
    const next = { ...empty };
    for (const key of Object.keys(next) as (keyof Draft)[])
      next[key] =
        typeof task[key] === "number" ? String(task[key]) : text(task[key]);
    setLabels(rows(task.task_issue_labels).map((row) => text(row.label_id)));
    setDraft(next);
    setEditing(task);
    setArchiving(false);
  };
  const refresh = () => {
    list.reload();
    onRefresh();
  };
  const save = () => {
    if (!canWrite || !draft.title.trim()) return;
    const task: ProjectHubInputs["updateTask"]["updates"] = {
      label_ids: labels,
      title: draft.title.trim(),
      description: draft.description || null,
      priority_id: draft.priority_id || null,
      assignee_id: draft.assignee_id || null,
      due_date: draft.due_date || null,
      cycle_id: draft.cycle_id || null,
      parent_issue_id: draft.parent_issue_id || null,
      estimate_points:
        draft.estimate_points === "" ? null : Number(draft.estimate_points),
      estimate_hours:
        draft.estimate_hours === "" ? null : Number(draft.estimate_hours),
      ...(draft.status_id ? { status_id: draft.status_id } : {}),
    };
    void mutation.run(
      () =>
        editing?.issue_id
          ? projectHubApi.updateTask(
              workspaceId,
              projectId,
              text(editing.issue_id),
              {
                ...task,
                expected_updated_at: text(editing.updated_at) || undefined,
              },
            )
          : projectHubApi.createTask(workspaceId, projectId, {
              ...task,
              title: draft.title.trim(),
            }),
      () => {
        setEditing(null);
        refresh();
      },
    );
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Tareas</h2>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditing(null);
              refresh();
            }}
          >
            Actualizar tareas
          </Button>
          {canWrite && (
            <Button
              size="sm"
              onClick={() => {
                setDraft(empty);
                setLabels([]);
                setEditing({});
                setArchiving(false);
              }}
            >
              Nueva tarea
            </Button>
          )}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Buscar tareas">
          <TextField
            aria-label="Buscar tareas"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={fieldClass}
          />
        </Field>
        <Choice
          label="Filtrar estado"
          value={status}
          onChange={setStatus}
          rows={rows(options.statuses)}
          id="status_id"
          empty="Todos los estados"
        />
        <Choice
          label="Filtrar responsable"
          value={assignee}
          onChange={setAssignee}
          rows={userRows(options.assignees)}
          id="user_id"
          empty="Todos los responsables"
        />
        <Choice
          label="Filtrar prioridad"
          value={priority}
          onChange={setPriority}
          rows={rows(options.priorities)}
          id="priority_id"
          empty="Todas las prioridades"
        />
        <Choice
          label="Filtrar ciclo"
          value={cycle}
          onChange={setCycle}
          rows={rows(options.cycles)}
          id="cycle_id"
          empty="Todos los ciclos"
        />
      </div>
      {optionError && (
        <p className="text-sm text-secondary">
          {optionError}{" "}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOptionRevision((value) => value + 1)}
          >
            Reintentar opciones
          </Button>
        </p>
      )}
      <MutationNotice message={mutation.message} />
      {editing && (
        <Card>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
          >
            <h3 className="font-semibold">
              {editing.issue_id ? "Detalle de tarea" : "Nueva tarea"}
            </h3>
            <Field label="Título de la tarea">
              <TextField
                required
                maxLength={500}
                value={draft.title}
                onChange={(event) => field("title")(event.target.value)}
                className={fieldClass}
                disabled={!canWrite}
              />
            </Field>
            <Field label="Descripción">
              <textarea
                maxLength={50000}
                value={draft.description}
                onChange={(event) => field("description")(event.target.value)}
                className={fieldClass}
                rows={4}
                disabled={!canWrite}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Choice
                label="Estado"
                value={draft.status_id}
                onChange={field("status_id")}
                rows={rows(options.statuses)}
                id="status_id"
                empty="Estado predeterminado"
                disabled={!canWrite}
              />
              <Choice
                label="Prioridad"
                value={draft.priority_id}
                onChange={field("priority_id")}
                rows={rows(options.priorities)}
                id="priority_id"
                disabled={!canWrite}
              />
              <Choice
                label="Responsable"
                value={draft.assignee_id}
                onChange={field("assignee_id")}
                rows={userRows(options.assignees)}
                id="user_id"
                disabled={!canWrite}
              />
              <Field label="Fecha límite">
                <TextField
                  type="date"
                  value={draft.due_date}
                  onChange={(event) => field("due_date")(event.target.value)}
                  className={fieldClass}
                  disabled={!canWrite}
                />
              </Field>
              <Choice
                label="Ciclo de trabajo"
                value={draft.cycle_id}
                onChange={field("cycle_id")}
                rows={rows(options.cycles)}
                id="cycle_id"
                disabled={!canWrite}
              />
              <Choice
                label="Tarea principal"
                value={draft.parent_issue_id}
                onChange={field("parent_issue_id")}
                rows={(list.state.data || []).filter(
                  (row) => row.issue_id !== editing.issue_id,
                )}
                id="issue_id"
                empty="Sin tarea principal"
                disabled={!canWrite}
              />
              <Field label="Estimación en puntos">
                <TextField
                  type="number"
                  min={0}
                  max={10000}
                  step="any"
                  value={draft.estimate_points}
                  onChange={(event) =>
                    field("estimate_points")(event.target.value)
                  }
                  className={fieldClass}
                  disabled={!canWrite}
                />
              </Field>
              <Field label="Estimación en horas">
                <TextField
                  type="number"
                  min={0}
                  max={100000}
                  step="any"
                  value={draft.estimate_hours}
                  onChange={(event) =>
                    field("estimate_hours")(event.target.value)
                  }
                  className={fieldClass}
                  disabled={!canWrite}
                />
              </Field>
            </div>
            <p className="text-xs text-secondary">
              La tarea principal se elige entre las tareas cargadas. Usa la
              búsqueda y Cargar más para encontrar otras.
            </p>
            <fieldset className="space-y-2">
              <legend className="text-xs text-secondary">Etiquetas</legend>
              <div className="flex flex-wrap gap-3">
                {rows(options.labels).map((label) => (
                  <label
                    key={text(label.label_id)}
                    className="flex items-center gap-2 rounded-full bg-surface-2 px-3 py-2 text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={labels.includes(text(label.label_id))}
                      disabled={!canWrite}
                      onChange={(event) =>
                        setLabels((current) =>
                          event.target.checked
                            ? [...current, text(label.label_id)]
                            : current.filter((id) => id !== label.label_id),
                        )
                      }
                    />
                    {text(label.name)}
                  </label>
                ))}
              </div>
              {canWrite && options.can_manage_labels === true && (
                <div className="flex items-end gap-2">
                  <Field label="Nueva etiqueta del equipo">
                    <TextField
                      maxLength={255}
                      value={labelName}
                      onChange={(event) => setLabelName(event.target.value)}
                      className={fieldClass}
                    />
                  </Field>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={!labelName.trim() || mutation.busy}
                    onClick={() =>
                      void mutation.run(
                        () =>
                          projectHubApi.createTaskLabel({
                            workspaceId,
                            projectId,
                            name: labelName.trim(),
                            color: "#6366F1",
                          }),
                        () => {
                          setLabelName("");
                          setOptionRevision((value) => value + 1);
                        },
                      )
                    }
                  >
                    Crear etiqueta
                  </Button>
                </div>
              )}
            </fieldset>
            <div className="flex flex-wrap gap-2">
              {canWrite && (
                <Button type="submit" size="sm" disabled={mutation.busy}>
                  Guardar tarea
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={mutation.busy && !mutation.uncertain}
                onClick={() => setEditing(null)}
              >
                Cerrar detalle
              </Button>
              {canManage && Boolean(editing.issue_id) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={mutation.busy}
                  onClick={() => setArchiving(true)}
                >
                  Archivar tarea
                </Button>
              )}
            </div>
          </form>
          {archiving && (
            <div className="mt-4 space-y-2">
              <p className="text-sm">
                Se retirará esta tarea de la lista activa. Sus archivos
                permanecerán guardados.
              </p>
              <Button
                size="sm"
                disabled={mutation.busy}
                onClick={() =>
                  void mutation.run(
                    () =>
                      projectHubApi.archiveTask({
                        workspaceId,
                        projectId,
                        taskId: text(editing.issue_id),
                        expectedUpdatedAt:
                          text(editing.updated_at) || undefined,
                      }),
                    () => {
                      setEditing(null);
                      refresh();
                    },
                  )
                }
              >
                Confirmar archivo de tarea
              </Button>
            </div>
          )}
          {Boolean(editing.issue_id) && (
            <TaskCollaboration
              key={text(editing.issue_id)}
              workspaceId={workspaceId}
              projectId={projectId}
              taskId={text(editing.issue_id)}
              canWrite={canWrite}
              canManage={canManage}
              onOpenWeb={onOpenWeb}
            />
          )}
        </Card>
      )}
      {list.state.loading ? (
        <p role="status" className="text-sm text-secondary">
          Cargando tareas…
        </p>
      ) : (
        <>
          {list.state.error && (
            <p role="alert" className="text-sm text-danger">
              {list.state.error}
            </p>
          )}
          {list.state.data?.length === 0 ? (
            <Card>
              <p className="text-sm text-secondary">
                Aún no hay tareas visibles con estos filtros.
              </p>
            </Card>
          ) : (
            <Card padded={false}>
              <div className="divide-y divide-border">
                {(list.state.data || []).map((task) => (
                  <button
                    key={text(task.issue_id)}
                    type="button"
                    className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left hover:bg-surface-2"
                    onClick={() => edit(task)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {text(task.title, "Sin título")}
                      </p>
                      <p className="mt-1 text-xs text-secondary">
                        {text(
                          relation(task.assignee).display_name,
                          "Sin asignar",
                        )}{" "}
                        · {dateLabel(task.due_date)} ·{" "}
                        {text(
                          relation(task.task_priorities).name,
                          "Sin prioridad",
                        )}
                        {task.parent_issue_id ? " · Subtarea" : ""}
                      </p>
                    </div>
                    <span className="rounded-full bg-surface-2 px-3 py-1 text-xs text-secondary">
                      {text(relation(task.task_statuses).name, "Sin estado")}
                    </span>
                  </button>
                ))}
              </div>
            </Card>
          )}
          <MoreButton
            hasMore={list.hasMore}
            loading={list.moreLoading}
            onMore={() => void list.more()}
          />
        </>
      )}
    </div>
  );
}
