import { TaskCollaboration } from "./TaskCollaboration";
import { useEffect, useState } from "react";
import { projectHubApi } from "../../services/project-hub-api";
import type { ProjectHubInputs } from "../../shared/project-hub";
import { Button } from "../ui/Button";
import { ProjectDialog } from './ProjectDialog';
import { ProjectGlyph } from './ProjectGlyph';
import { TaskResources } from './TaskResources';
import { taskResource, taskStage, taskStageFor, type TaskResource } from '../../shared/task-workflow';
import { safeWebUrl } from '../../services/project-web-url';
import { taskColumns } from './task-board-model';
import '../../styles/task-editor.css';
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
  started_at: string;
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
  started_at: "",
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
  const [resources, setResources] = useState<TaskResource[]>([]);
  const [resourcesChanged, setResourcesChanged] = useState(false);
  const [legacyResources, setLegacyResources] = useState(false);
  const [validationError, setValidationError] = useState('');
  const statusChoices = taskColumns([], rows(options.statuses)).map(column => ({ value: column.statusId || `stage:${column.type}`, label: column.name, description: column.statusId ? undefined : options.can_manage_statuses === true ? 'Se configurará al guardar' : 'Requiere administración del equipo', disabled: !column.statusId && options.can_manage_statuses !== true }));
  const configuredStatuses = rows(options.statuses);
  const defaultStatus = configuredStatuses.find(row => row.is_default === true && row.is_closed !== true) || configuredStatuses.find(row => taskStageFor(text(row.name), text(row.status_type)) === 'todo') || configuredStatuses.find(row => row.is_closed !== true);
  const selectedStatus = draft.status_id || text(defaultStatus?.status_id) || 'stage:todo';
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
    next.started_at = text(task.started_at).slice(0, 10);
    next.due_date = text(task.due_date).slice(0, 10);
    const linked = Array.isArray(task.external_links) ? task.external_links : [];
    const parsed = linked.map(item => taskResource.safeParse(item));
    setResources(parsed.flatMap(item => item.success ? [item.data] : []));
    setLegacyResources(parsed.some(item => !item.success) || (task.external_links != null && !Array.isArray(task.external_links)));
    setResourcesChanged(false); setValidationError(''); setLabelName('');
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
    setResources([]); setResourcesChanged(false); setLegacyResources(false); setValidationError(''); setLabelName('');
  };
  const moveTask = (task: DataRecord, statusId: string) => {
    if (!canWrite || mutation.busy || task.status_id === statusId) return;
    void mutation.run(() => projectHubApi.updateTask(workspaceId, projectId, text(task.issue_id), { status_id: statusId, expected_updated_at: text(task.updated_at) || undefined }), refresh);
  };
  const save = () => {
    if (!canWrite || mutation.busy || !draft.title.trim()) return;
    if (draft.started_at && draft.due_date && draft.started_at > draft.due_date) { setValidationError('La fecha de inicio debe ser anterior o igual a la fecha límite.'); return; }
    if (resourcesChanged && resources.some(item => !taskResource.safeParse(item).success)) { setValidationError('Revisa el nombre y el enlace HTTP o HTTPS de cada recurso.'); return; }
    const statusOption = statusChoices.find(option => option.value === selectedStatus);
    if (statusOption?.disabled) { setValidationError('Selecciona un estado disponible. Si faltan estados, pide a un administrador del equipo que los configure.'); return; }
    setValidationError('');
    const task: ProjectHubInputs["updateTask"]["updates"] = {
      label_ids: labels,
      title: draft.title.trim(),
      description: draft.description || null,
      priority_id: draft.priority_id || null,
      assignee_id: draft.assignee_id || null,
      due_date: draft.due_date || null,
      started_at: draft.started_at ? draft.started_at === text(editing?.started_at).slice(0, 10) ? text(editing?.started_at) : `${draft.started_at}T00:00:00.000Z` : null,
      ...(resourcesChanged ? { external_links: resources.map(item => ({ ...item, name: item.name.trim(), url: safeWebUrl(item.url)! })) } : {}),
      cycle_id: draft.cycle_id || null,
      parent_issue_id: draft.parent_issue_id || null,
      estimate_points:
        draft.estimate_points === "" ? null : Number(draft.estimate_points),
      estimate_hours:
        draft.estimate_hours === "" ? null : Number(draft.estimate_hours),
      ...(selectedStatus.startsWith('stage:') ? { status_stage: taskStage.parse(selectedStatus.slice(6)) } : { status_id: selectedStatus }),
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
      {optionError && !editing && (
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
      {!editing && <MutationNotice message={mutation.message} />}
      {editing && (
        <ProjectDialog title={editing.issue_id ? 'Detalle de tarea' : 'Nueva tarea'} className="task-editor-dialog" closeDisabled={mutation.busy && !mutation.uncertain} onClose={() => setEditing(null)}>
          <form
            className="task-editor-form"
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
          >
            <div className="task-editor-intro"><span><ProjectGlyph name="tasks" size={23} /></span><div><h3>{editing.issue_id ? 'Dale seguimiento a tu tarea' : 'Una idea, un siguiente paso'}</h3><p>Define qué hay que hacer y reúne el contexto para tu equipo.</p></div></div>
            <div className="task-editor-layout"><section className="task-editor-main" aria-label="Detalles de la tarea">
            <Field label="Título de la tarea">
              <TextField
                autoFocus
                data-dialog-autofocus
                placeholder="¿Qué necesita hacer el equipo?"
                required
                maxLength={500}
                value={draft.title}
                onChange={(event) => field("title")(event.target.value)}
                className={fieldClass}
                disabled={!canWrite || mutation.busy}
              />
            </Field>
            <Field label="Descripción">
              <textarea
                placeholder="Añade contexto, objetivos o criterios para completar la tarea…"
                maxLength={50000}
                value={draft.description}
                onChange={(event) => field("description")(event.target.value)}
                className={fieldClass}
                rows={5}
                disabled={!canWrite || mutation.busy}
              />
            </Field>
            <TaskResources value={resources} onChange={value => { setResources(value); setResourcesChanged(true); }} disabled={!canWrite || mutation.busy} legacy={legacyResources} onOpenWeb={onOpenWeb} />
            </section><aside className="task-editor-planning" aria-label="Planificación de la tarea"><h3><ProjectGlyph name="cycles" size={17} />Planificación</h3>
              <div className="min-w-0 text-xs text-secondary"><span>Estado</span><SelectDropdown aria-label="Estado" className="mt-1" value={selectedStatus} onChange={field('status_id')} options={statusChoices} disabled={!canWrite || mutation.busy} placeholder="Selecciona un estado" /></div>
              {!configuredStatuses.length && options.can_manage_statuses !== true && !optionError && <p className="task-editor-hint">El equipo aún no tiene estados disponibles. Un administrador del equipo debe configurar las fases.</p>}
              <div className="min-w-0 text-xs text-secondary"><span>Dificultad</span><SelectDropdown aria-label="Dificultad" className="mt-1" value={taskDifficultyFor(draft.estimate_points === '' ? null : Number(draft.estimate_points))} onChange={value => { const choice = taskDifficultyOptions.find(option => option.value === value); field('estimate_points')(choice?.points == null ? '' : String(choice.points)); }} options={taskDifficultyOptions.map(option => ({ value: option.value, label: option.label }))} disabled={!canWrite || mutation.busy} /><p className="mt-1 text-[11px]">Elige el esfuerzo estimado para completar la tarea.</p></div>
              <Choice
                label="Responsable"
                value={draft.assignee_id}
                onChange={field("assignee_id")}
                rows={userRows(options.assignees)}
                id="user_id"
                disabled={!canWrite || mutation.busy}
              />
              <div className="task-editor-dates"><Field label="Fecha de inicio"><TextField type="date" value={draft.started_at} max={draft.due_date || undefined} onChange={event => field('started_at')(event.target.value)} className={fieldClass} disabled={!canWrite || mutation.busy} /></Field>
              <Field label="Fecha límite">
                <TextField
                  type="date"
                  min={draft.started_at || undefined}
                  value={draft.due_date}
                  onChange={(event) => field("due_date")(event.target.value)}
                  className={fieldClass}
                  disabled={!canWrite || mutation.busy}
                />
              </Field>
              </div>
              <details className="task-editor-advanced"><summary>Más opciones</summary><div>
              <Choice
                label="Ciclo de trabajo"
                value={draft.cycle_id}
                onChange={field("cycle_id")}
                rows={rows(options.cycles)}
                id="cycle_id"
                disabled={!canWrite || mutation.busy}
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
                disabled={!canWrite || mutation.busy}
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
                  disabled={!canWrite || mutation.busy}
                />
              </Field>
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
                      disabled={!canWrite || mutation.busy}
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
              </div></details>
            </aside></div>
            <div className="task-editor-feedback"><MutationNotice message={mutation.message} />{validationError && <p role="alert">{validationError}</p>}{optionError && <div role="alert">{optionError}<Button type="button" size="sm" variant="ghost" onClick={() => setOptionRevision(value => value + 1)}>Reintentar opciones</Button></div>}</div>
            <div className="task-editor-footer">
              <span>{editing.issue_id ? 'Los cambios se guardan al confirmar.' : 'Tu siguiente paso empieza aquí.'}</span>
              <div>
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
        </ProjectDialog>
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
