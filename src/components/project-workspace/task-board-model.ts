import { relation, text, type DataRecord } from './dashboard-data';
import { taskStages as stages, taskStageFor } from '../../shared/task-workflow';

export interface TaskFilters { search: string; status: string; assignee: string; difficulty: string; cycle: string }
export const emptyTaskFilters: TaskFilters = { search: '', status: '', assignee: '', difficulty: '', cycle: '' };

export interface Column { key: string; name: string; type: string; statusId?: string; tasks: DataRecord[]; color?: string }
function columnStage(column: Column): string {
  return taskStageFor(column.name, column.type);
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
