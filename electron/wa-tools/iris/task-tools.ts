export const IRIS_TASK_TOOLS = [
  {
    name: 'iris_get_my_tasks',
    description: 'Obtiene las tareas/issues asignadas al usuario autenticado en Project Hub.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        project_id: { type: 'STRING' as const, description: 'Opcional. Filtrar por proyecto especifico.' },
        limit: { type: 'NUMBER' as const, description: 'Maximo de tareas a mostrar. Por defecto 20.' },
      },
    },
  },
  {
    name: 'iris_get_issues',
    description: 'Lista las issues/tareas en Project Hub. Puede filtrar por equipo, proyecto o asignado.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        team_id: { type: 'STRING' as const, description: 'Opcional. Filtrar por equipo.' },
        project_id: { type: 'STRING' as const, description: 'Opcional. Filtrar por proyecto.' },
        assignee_id: { type: 'STRING' as const, description: 'Opcional. Filtrar por usuario asignado.' },
        limit: { type: 'NUMBER' as const, description: 'Maximo de issues a mostrar. Por defecto 20.' },
      },
    },
  },
  {
    name: 'iris_create_task',
    description: 'Crea una nueva tarea/issue en Project Hub. Requiere estar autenticado. team_id y title son obligatorios.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        team_id: { type: 'STRING' as const, description: 'ID del equipo donde crear la tarea.' },
        title: { type: 'STRING' as const, description: 'Titulo de la tarea.' },
        description: { type: 'STRING' as const, description: 'Descripcion detallada de la tarea.' },
        project_id: { type: 'STRING' as const, description: 'ID del proyecto para asociar la tarea.' },
        priority_id: { type: 'STRING' as const, description: 'ID de la prioridad.' },
        assignee_id: { type: 'STRING' as const, description: 'ID del usuario a asignar.' },
        due_date: { type: 'STRING' as const, description: 'Fecha de vencimiento en formato YYYY-MM-DD.' },
        status_name: { type: 'STRING' as const, description: 'Nombre del estado inicial.' },
      },
      required: ['team_id', 'title'],
    },
  },
  {
    name: 'iris_update_task_status',
    description: 'Cambia el estado de una tarea/issue existente en Project Hub.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        issue_id: { type: 'STRING' as const, description: 'ID unico de la tarea.' },
        issue_number: { type: 'NUMBER' as const, description: 'Numero de la tarea. Alternativa a issue_id.' },
        team_id: { type: 'STRING' as const, description: 'ID del equipo para encontrar la tarea por numero.' },
        new_status_name: { type: 'STRING' as const, description: 'Nombre del nuevo estado.' },
        new_status_id: { type: 'STRING' as const, description: 'ID directo del nuevo estado.' },
      },
    },
  },
];
