const IRIS_KEYWORDS = [
  'proyecto', 'proyectos', 'project', 'projects',
  'issue', 'issues', 'tarea', 'tareas', 'task', 'tasks',
  'equipo', 'equipos', 'team', 'teams',
  'sprint', 'ciclo', 'cycle',
  'pendiente', 'pendientes',
  'estado de', 'status',
  'prioridad', 'priority',
  'asignar', 'assignee', 'asignadas', 'asignado',
  'backlog', 'kanban',
  'project hub', 'iris',
  'crear proyecto', 'crear tarea', 'create project', 'create task',
  'actualizar', 'update',
  'mis tareas', 'my tasks',
  'avance', 'progreso', 'progress',
  'login', 'inicio de sesion', 'iniciar sesion', 'iniciar sesión',
  'cerrar sesion', 'cerrar sesión', 'logout',
  'autenticar', 'authenticate',
];

export function needsIrisData(message: string): boolean {
  const lower = message.toLowerCase();
  return IRIS_KEYWORDS.some((keyword) => lower.includes(keyword));
}
