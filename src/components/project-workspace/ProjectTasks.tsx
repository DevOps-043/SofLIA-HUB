import { TaskCollaboration } from "./TaskCollaboration";
import { useEffect, useState } from "react";
import { projectHubApi } from "../../services/project-hub-api";
import type { ProjectHubInputs } from "../../shared/project-hub";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { TextField } from "../ui/TextField";
import {
  record,
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
import { TaskBoard } from './TaskBoard';
import { TaskToolbar } from './TaskToolbar';
import { emptyTaskFilters, type TaskFilters } from './task-board-model';
import { taskDifficultyFor, taskDifficultyOptions, type TaskDifficulty } from '../../shared/task-difficulty';
import SelectDropdown from '../ui/SelectDropdown';

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
function ProjectTaskPanel({
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
  const [filterValues, setFilterValues] = useState<TaskFilters>(emptyTaskFilters);
  const [view, setView] = useState<'board' | 'list'>('board');
  const [searchTerm, setSearchTerm] = useState('');
  const { search, status, assignee, difficulty, cycle } = filterValues;
  useEffect(() => { const timer = window.setTimeout(() => setSearchTerm(search.trim()), 200); return () => window.clearTimeout(timer); }, [search]);
  const filters = {
    search: searchTerm || undefined,
    statusId: status || undefined,
    assigneeId: assignee || undefined,
    difficulty: (difficulty || undefined) as TaskDifficulty | undefined,
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
    setOptionRevision(value => value + 1);
    onRefresh();
  };
  const newTask = (statusId?: string) => {
    setDraft({ ...empty, status_id: statusId || '' }); setLabels([]); setEditing({}); setArchiving(false);
  };
  const moveTask = (task: DataRecord, statusId: string) => {
    if (!canWrite || mutation.busy || task.status_id === statusId) return;
    void mutation.run(() => projectHubApi.updateTask(workspaceId, projectId, text(task.issue_id), { status_id: statusId, expected_updated_at: text(task.updated_at) || undefined }), refresh);
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
    <div className="project-tasks-panel">
      <TaskToolbar filters={filterValues} onFilters={setFilterValues} view={view} onView={setView} options={options} count={list.state.data?.length || 0} partial={list.hasMore} loading={list.state.loading} canWrite={canWrite} busy={mutation.busy} onCreate={() => newTask()} onRefresh={() => { setEditing(null); refresh(); }} />
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
              <div className="min-w-0 text-xs text-secondary"><span>Dificultad</span><SelectDropdown aria-label="Dificultad" className="mt-1" value={taskDifficultyFor(draft.estimate_points === '' ? null : Number(draft.estimate_points))} onChange={value => { const choice = taskDifficultyOptions.find(option => option.value === value); field('estimate_points')(choice?.points == null ? '' : String(choice.points)); }} options={taskDifficultyOptions.map(option => ({ value: option.value, label: option.label }))} disabled={!canWrite} /><p className="mt-1 text-[11px]">Elige el esfuerzo estimado para completar la tarea.</p></div>
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
      {list.state.loading ? <div role="status" className="task-board-loading"><span />Cargando tareas…</div> : <>
        {list.state.error && <div role="alert" className="task-board-notice"><p>{list.state.error}</p><Button size="sm" variant="ghost" onClick={refresh}>Reintentar tareas</Button></div>}
        {list.state.data && <>
          {list.state.data?.length === 0 && <p className="task-results-note">Aún no hay tareas visibles con estos filtros.{Object.values(filterValues).some(Boolean) ? ' Cambia o limpia los filtros para ver más.' : canWrite ? ' Crea la primera desde cualquier columna.' : ''}</p>}
          <TaskBoard tasks={list.state.data || []} statuses={rows(options.statuses)} people={userRows(options.assignees)} view={view} canWrite={canWrite} busy={mutation.busy} onOpen={edit} onCreate={newTask} onMove={moveTask} />
        </>}
        {list.hasMore && <p className="task-results-note">Mostrando las tareas cargadas. Carga más para completar este resultado.</p>}
        <MoreButton hasMore={list.hasMore} loading={list.moreLoading} onMore={() => void list.more()} />
      </>}
    </div>
  );
}
export function ProjectTasks(props: Parameters<typeof ProjectTaskPanel>[0]) {
  return <ProjectTaskPanel key={`${props.workspaceId}/${props.projectId}`} {...props} />;
}
