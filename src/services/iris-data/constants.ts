export const IRIS_KEYWORDS = [
  'proyecto', 'proyectos', 'project', 'projects',
  'issue', 'issues', 'tarea', 'tareas', 'task', 'tasks',
  'equipo', 'equipos', 'team', 'teams',
  'prioridad', 'priority', 'asignar', 'assignee', 'responsable',
  'project hub', 'iris', 'crear proyecto', 'crear tarea',
  'create project', 'create task', 'mis tareas', 'my tasks',
];

export const PROJECT_STATUS_COLORS: Record<string, string> = {
  active: '#22c55e',
  completed: '#3b82f6',
  on_hold: '#f59e0b',
  planning: '#8b5cf6',
  cancelled: '#ef4444',
  archived: '#6b7280',
};

export const ISSUE_STATUS_TYPE_COLORS: Record<string, string> = {
  done: '#22c55e',
  in_progress: '#3b82f6',
  in_review: '#8b5cf6',
  todo: '#f59e0b',
  backlog: '#6b7280',
  cancelled: '#ef4444',
};

export function needsIrisData(message: string): boolean {
  const lower = message.toLowerCase();
  return IRIS_KEYWORDS.some((keyword) => lower.includes(keyword));
}
