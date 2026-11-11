import type { CSSProperties, DragEvent, ReactNode } from 'react';
import { dateLabel, relation, text, type DataRecord } from './dashboard-data';
import { taskColumns, type Column } from './task-board-model';
import { taskDifficultyFor, taskDifficultyOptions } from '../../shared/task-difficulty';

export function TaskIcon({ name }: { name: 'board' | 'list' | 'search' | 'refresh' | 'plus' | 'calendar' | 'filter' }) {
  const paths = {
    board: <><rect x="3" y="4" width="5" height="16" rx="1.4" /><rect x="10" y="4" width="5" height="11" rx="1.4" /><rect x="17" y="4" width="4" height="14" rx="1.4" /></>,
    list: <><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3 6h.01M3 12h.01M3 18h.01" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
    refresh: <><path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    calendar: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></>,
    filter: <><path d="M4 6h16M7 12h10M10 18h4" /></>,
  };
  return <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
function statusStyle(column: Column): CSSProperties | undefined {
  return column.color && /^#[\da-f]{6}$/i.test(column.color) ? { '--task-status-color': column.color } as CSSProperties : undefined;
}
function TaskStatusGlyph({ type }: { type: string }) {
  const paths: Record<string, ReactNode> = {
    backlog: <><path d="M5 4h14M4 8h16l2 11a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1Z" fill="currentColor" fillOpacity=".12" /><path d="M3 14h5l2 3h4l2-3h5" /></>,
    pending: <><circle cx="12" cy="12" r="9" fill="currentColor" fillOpacity=".12" /><path d="M12 7v5l3 2" /></>,
    todo: <><rect x="4" y="4" width="16" height="16" rx="5" /><path d="M9 12h6" /></>,
    in_progress: <><circle cx="12" cy="12" r="9" strokeOpacity=".3" /><path d="M12 3a9 9 0 0 1 9 9" strokeWidth="3" /><path d="m10 8 6 4-6 4Z" fill="currentColor" stroke="none" /></>,
    in_review: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" fill="currentColor" fillOpacity=".1" /><circle cx="12" cy="12" r="3" /></>,
    done: <><circle cx="12" cy="12" r="9" fill="currentColor" fillOpacity=".15" /><path d="m7.5 12 3 3 6-6" strokeWidth="2.2" /></>,
    cancelled: <><circle cx="12" cy="12" r="9" fill="currentColor" fillOpacity=".1" /><path d="m9 9 6 6M15 9l-6 6" /></>,
  };
  return <svg className="task-status-symbol" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[type] ?? paths.todo}</svg>;
}
function personFor(task: DataRecord, people: DataRecord[]) {
  const related = relation(task.assignee);
  return Object.keys(related).length ? related : people.find(person => person.user_id === task.assignee_id) ?? {};
}
function TaskPerson({ task, people }: { task: DataRecord; people: DataRecord[] }) {
  const person = personFor(task, people);
  const name = text(person.display_name) || text(person.email) || (task.assignee_id ? 'Responsable sin perfil' : 'Sin asignar');
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase();
  const avatar = text(person.avatar_url);
  return <span className="task-person" title={name}>{/^https:\/\//i.test(avatar) ? <img src={avatar} alt="" referrerPolicy="no-referrer" /> : <span className={`task-avatar ${task.assignee_id ? '' : 'is-unassigned'}`} aria-hidden="true">{task.assignee_id ? initials : '–'}</span>}<span className="task-person-name">{name}</span></span>;
}
function Difficulty({ task }: { task: DataRecord }) {
  const level = taskDifficultyFor(task.estimate_points);
  const label = taskDifficultyOptions.find(option => option.value === level)!.label;
  return <span className={`task-difficulty is-${level}`} title={typeof task.estimate_points === 'number' ? `${task.estimate_points} puntos` : label}><span className="task-difficulty-bars" aria-hidden="true"><i /><i /><i /></span><span>{label}</span></span>;
}
function TaskDate({ task }: { task: DataRecord }) {
  if (!task.due_date) return null;
  const now = new Date(); const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const status = relation(task.task_statuses);
  const overdue = text(task.due_date) < today && !status.is_closed && !['done', 'cancelled'].includes(text(status.status_type));
  return <span className={`task-date ${overdue ? 'is-overdue' : ''}`} title={overdue ? 'Fecha vencida' : 'Fecha límite'}><TaskIcon name="calendar" />{dateLabel(task.due_date)}</span>;
}
interface Props {
  tasks: DataRecord[];
  statuses: DataRecord[];
  people: DataRecord[];
  view: 'board' | 'list';
  canWrite: boolean;
  busy: boolean;
  onOpen(task: DataRecord): void;
  onCreate(statusId?: string): void;
  onMove(task: DataRecord, statusId: string): void;
}
export function TaskBoard(props: Props) {
  const columns = taskColumns(props.tasks, props.statuses);
  const writable = (column: Column) => props.canWrite && !!column.statusId && props.statuses.some(status => status.status_id === column.statusId);
  const drop = (event: DragEvent, column: Column) => {
    event.preventDefault(); event.currentTarget.classList.remove('is-drag-over');
    if (props.busy || !column.statusId || !writable(column)) return;
    const id = event.dataTransfer.getData('application/x-soflia-task');
    const task = props.tasks.find(item => item.issue_id === id);
    if (task && task.status_id !== column.statusId) props.onMove(task, column.statusId);
  };
  return <div className={props.view === 'board' ? 'project-task-board custom-scrollbar' : 'project-task-list'} aria-label={props.view === 'board' ? 'Tablero de tareas' : 'Lista de tareas'}>
    {columns.map(column => <section key={column.key} className={`task-column state-${column.type}`} aria-label={column.name} style={statusStyle(column)} onDragOver={event => { if (!props.busy && writable(column)) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; event.currentTarget.classList.add('is-drag-over'); } }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) event.currentTarget.classList.remove('is-drag-over'); }} onDrop={event => drop(event, column)}>
      <header className="task-column-header"><TaskStatusGlyph type={column.type} /><h3 title={column.statusId ? column.name : 'Este estado aún no está configurado en el proyecto'}>{column.name}</h3><span className="task-column-count" aria-label={`${column.tasks.length} tareas cargadas`}>{column.tasks.length}</span>{writable(column) && <button type="button" disabled={props.busy} className="task-column-add" aria-label={`Añadir tarea en ${column.name}`} onClick={() => props.onCreate(column.statusId)}><TaskIcon name="plus" /></button>}</header>
      <div className="task-column-body">
        {column.tasks.map(task => <button key={text(task.issue_id)} type="button" className="project-task-card" onClick={() => props.onOpen(task)} draggable={props.canWrite && !props.busy} onDragStart={event => { if (!props.canWrite || props.busy) { event.preventDefault(); return; } event.dataTransfer.setData('application/x-soflia-task', text(task.issue_id)); event.dataTransfer.effectAllowed = 'move'; }}>
          <span className="task-card-top"><span className="task-identifier">{text(task.identifier) || (typeof task.issue_number === 'number' ? `#${task.issue_number}` : 'Tarea')}{task.parent_issue_id ? ' · Subtarea' : ''}</span><Difficulty task={task} /></span>
          <span className="task-card-title">{text(task.title, 'Sin título')}</span>
          {rowsForLabels(task).length > 0 && <span className="task-card-labels">{rowsForLabels(task).slice(0, 2).map(label => <span key={text(label.label_id) || text(label.name)}>{text(label.name)}</span>)}</span>}
          <span className="task-card-bottom"><TaskPerson task={task} people={props.people} /><TaskDate task={task} /></span>
        </button>)}
        {!column.tasks.length && <div className="task-column-empty">Sin tareas{writable(column) && <button type="button" disabled={props.busy} onClick={() => props.onCreate(column.statusId)}><TaskIcon name="plus" />Crear tarea</button>}</div>}
      </div>
    </section>)}
  </div>;
}
function rowsForLabels(task: DataRecord) {
  return Array.isArray(task.task_issue_labels) ? task.task_issue_labels.map(item => relation(relation(item).task_labels)).filter(item => item.name) : [];
}
