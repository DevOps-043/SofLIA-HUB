import { relation, text, type DataRecord } from './dashboard-data';

export interface TaskFilters { search: string; status: string; assignee: string; difficulty: string; cycle: string }
export const emptyTaskFilters: TaskFilters = { search: '', status: '', assignee: '', difficulty: '', cycle: '' };

export interface Column { key: string; name: string; type: string; statusId?: string; tasks: DataRecord[]; color?: string }
const stages = [
  { type: 'backlog', name: 'Backlog' },
  { type: 'pending', name: 'Pendientes' },
  { type: 'todo', name: 'Por hacer' },
  { type: 'in_progress', name: 'En curso' },
  { type: 'in_review', name: 'En revisión' },
  { type: 'done', name: 'Completadas' },
  { type: 'cancelled', name: 'Canceladas' },
];
function columnStage(column: Column): string {
  // Pendientes puede compartir el tipo persistido todo, pero conserva su propio ID.
  const name = column.name.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return ['pendiente', 'pendientes', 'pending'].includes(name) && ['todo', 'unknown'].includes(column.type) ? 'pending' : column.type;
}
export function taskColumns(tasks: DataRecord[], statuses: DataRecord[]): Column[] {
  const columns: Column[] = statuses.map(status => ({ key: text(status.status_id), statusId: text(status.status_id), name: text(status.name, 'Sin estado'), type: text(status.status_type, 'todo'), color: text(status.color), tasks: [] }));
  for (const task of tasks) {
    const status = relation(task.task_statuses);
    const key = text(task.status_id) || text(status.status_id) || `unknown:${text(status.name)}`;
    let column = columns.find(item => item.key === key);
    if (!column) {
      column = { key, statusId: text(task.status_id) || text(status.status_id) || undefined, name: text(status.name, 'Sin estado'), type: text(status.status_type, 'unknown'), color: text(status.color), tasks: [] };
      columns.push(column);
    }
    column.tasks.push(task);
  }
  const ordered = stages.flatMap(stage => {
    const configured = columns.filter(column => columnStage(column) === stage.type);
    return configured.length ? configured.map(column => ({ ...column, type: stage.type })) : [{ key: `empty:${stage.type}`, name: stage.name, type: stage.type, tasks: [] }];
  });
  return [...ordered, ...columns.filter(column => !stages.some(stage => stage.type === columnStage(column)))];
}
