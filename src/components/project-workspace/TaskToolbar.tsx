import SelectDropdown from '../ui/SelectDropdown';
import { Button } from '../ui/Button';
import { rows, userRows } from './management-state';
import { text, type DataRecord } from './dashboard-data';
import { TaskIcon } from './TaskBoard';
import { taskDifficultyOptions } from '../../shared/task-difficulty';

import { emptyTaskFilters, type TaskFilters } from './task-board-model';
interface Props {
  filters: TaskFilters;
  onFilters(filters: TaskFilters): void;
  view: 'board' | 'list';
  onView(view: 'board' | 'list'): void;
  options: DataRecord;
  count: number;
  partial: boolean;
  loading: boolean;
  canWrite: boolean;
  busy: boolean;
  onCreate(): void;
  onRefresh(): void;
}
export function TaskToolbar(props: Props) {
  const filters = props.filters;
  const change = (key: keyof TaskFilters, value: string) => props.onFilters({ ...filters, [key]: value });
  const choices: Array<{ key: Exclude<keyof TaskFilters, 'search'>; label: string; empty: string; rows: DataRecord[]; id: string }> = [
    { key: 'status' as const, label: 'Filtrar estado', empty: 'Estado', rows: rows(props.options.statuses), id: 'status_id' },
    { key: 'assignee' as const, label: 'Filtrar responsable', empty: 'Responsable', rows: userRows(props.options.assignees), id: 'user_id' },
    { key: 'difficulty' as const, label: 'Filtrar dificultad', empty: 'Dificultad', rows: taskDifficultyOptions.map(option => ({ value: option.value, name: option.label })), id: 'value' },
    { key: 'cycle' as const, label: 'Filtrar ciclo', empty: 'Ciclo', rows: rows(props.options.cycles), id: 'cycle_id' },
  ];
  const active = Object.values(filters).some(Boolean);
  return <div className="task-toolbar">
    <div className="task-toolbar-heading"><div className="task-toolbar-title"><h2>Tareas</h2><span className="task-total">{props.loading ? '…' : `${props.count}${props.partial ? '+' : ''}`}</span></div><div className="task-toolbar-actions"><div className="task-view-switch" role="group" aria-label="Vista de tareas">{(['board', 'list'] as const).map(view => <button key={view} type="button" aria-pressed={props.view === view} onClick={() => props.onView(view)}><TaskIcon name={view} />{view === 'board' ? 'Tablero' : 'Lista'}</button>)}</div><button type="button" className="task-refresh" aria-label="Actualizar tareas" title="Actualizar tareas y opciones" onClick={props.onRefresh}><TaskIcon name="refresh" /></button>{props.canWrite && <Button size="sm" disabled={props.busy} onClick={props.onCreate}><TaskIcon name="plus" />Nueva tarea</Button>}</div></div>
    <div className="task-filter-bar"><label className="task-search"><TaskIcon name="search" /><input aria-label="Buscar tareas" placeholder="Buscar tareas…" value={filters.search} onChange={event => change('search', event.target.value)} /></label><span className="task-filter-divider" /><span className="task-filter-mark" aria-hidden="true"><TaskIcon name="filter" /></span>{choices.map(choice => <div key={choice.key} className={`task-filter-select ${filters[choice.key] ? 'is-active' : ''}`}><SelectDropdown size="compact" aria-label={choice.label} value={filters[choice.key]} onChange={value => change(choice.key, value)} options={[{ value: '', label: choice.empty }, ...choice.rows.filter(row => row[choice.id]).map(row => ({ value: text(row[choice.id]), label: text(row.name) || text(row.display_name) || text(row.email) || text(row[choice.id]) }))]} /></div>)}{active && <button type="button" className="task-clear-filters" onClick={() => props.onFilters(emptyTaskFilters)}>Limpiar filtros</button>}</div>
  </div>;
}
