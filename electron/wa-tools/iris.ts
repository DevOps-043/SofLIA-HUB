/**
 * Tools de IRIS (Project Hub): autenticación + lectura/escritura de tareas,
 * proyectos, equipos.
 */

export const IRIS_TOOLS = [
  {
    name: 'iris_login',
    description: 'Autentica al usuario de WhatsApp con el sistema Project Hub (IRIS). Necesita email y contraseña. Después de autenticarse, podrá consultar sus tareas, proyectos y equipos. Solo úsala cuando el usuario te dé sus credenciales explícitamente.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        email: { type: 'STRING' as const, description: 'Email o nombre de usuario del sistema SOFIA/Project Hub.' },
        password: { type: 'STRING' as const, description: 'Contraseña del usuario.' },
      },
      required: ['email', 'password'],
    },
  },
  {
    name: 'iris_logout',
    description: 'Cierra la sesión del usuario en el sistema Project Hub. Sus datos de IRIS ya no estarán vinculados a su número de WhatsApp.',
    parameters: { type: 'OBJECT' as const, properties: {} },
  },
  {
    name: 'iris_get_my_tasks',
    description: 'Obtiene las tareas/issues asignadas al usuario autenticado en Project Hub. El usuario debe haberse autenticado previamente con iris_login.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        project_id: { type: 'STRING' as const, description: 'Opcional. Filtrar por proyecto específico.' },
        limit: { type: 'NUMBER' as const, description: 'Máximo de tareas a mostrar. Por defecto 20.' },
      },
    },
  },
  {
    name: 'iris_get_projects',
    description: 'Lista los proyectos disponibles en Project Hub. Puede filtrar por equipo.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        team_id: { type: 'STRING' as const, description: 'Opcional. Filtrar por equipo específico.' },
      },
    },
  },
  {
    name: 'iris_get_teams',
    description: 'Lista los equipos disponibles en Project Hub.',
    parameters: { type: 'OBJECT' as const, properties: {} },
  },
  {
    name: 'iris_get_team_members',
    description: 'Lista los miembros de un equipo de Project Hub para poder asignar tareas correctamente.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        team_id: { type: 'STRING' as const, description: 'ID del equipo.' },
        team_name: { type: 'STRING' as const, description: 'Nombre o slug del equipo si no conoces el ID.' },
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
        assignee_id: { type: 'STRING' as const, description: 'Opcional. Filtrar por usuario asignado (user_id).' },
        limit: { type: 'NUMBER' as const, description: 'Máximo de issues a mostrar. Por defecto 20.' },
      },
    },
  },
  {
    name: 'iris_create_task',
    description: 'Crea una nueva tarea/issue en Project Hub. Requiere estar autenticado. El team_id es obligatorio (puedes obtenerlo de iris_get_teams). El título es obligatorio.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        team_id: { type: 'STRING' as const, description: 'ID del equipo donde crear la tarea (obligatorio).' },
        title: { type: 'STRING' as const, description: 'Título de la tarea (obligatorio).' },
        description: { type: 'STRING' as const, description: 'Descripción detallada de la tarea.' },
        project_id: { type: 'STRING' as const, description: 'ID del proyecto para asociar la tarea.' },
        priority_id: { type: 'STRING' as const, description: 'ID de la prioridad (usa iris_get_statuses para ver prioridades disponibles).' },
        assignee_id: { type: 'STRING' as const, description: 'ID del usuario a asignar. Usa el userId del usuario autenticado para auto-asignarse.' },
        due_date: { type: 'STRING' as const, description: 'Fecha de vencimiento en formato YYYY-MM-DD.' },
        status_name: { type: 'STRING' as const, description: 'Nombre del estado inicial (ej: "Backlog", "To Do", "In Progress"). Si no se especifica, se usa el estado predeterminado del equipo.' },
      },
      required: ['team_id', 'title'],
    },
  },
  {
    name: 'iris_update_task_status',
    description: 'Cambia el estado de una tarea/issue existente en Project Hub. Puede buscar por issue_id o issue_number. Los estados típicos son: Backlog, To Do, In Progress, In Review, Done, Cancelled.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        issue_id: { type: 'STRING' as const, description: 'ID único de la tarea (UUID). Usar si se conoce.' },
        issue_number: { type: 'NUMBER' as const, description: 'Número de la tarea (ej: #5). Alternativa a issue_id.' },
        team_id: { type: 'STRING' as const, description: 'ID del equipo (ayuda a encontrar la tarea por número).' },
        new_status_name: { type: 'STRING' as const, description: 'Nombre del nuevo estado: "Backlog", "To Do", "In Progress", "In Review", "Done", "Cancelled".' },
        new_status_id: { type: 'STRING' as const, description: 'Alternativa: ID directo del nuevo estado.' },
      },
    },
  },
  {
    name: 'iris_create_project',
    description: 'Crea un nuevo proyecto en Project Hub. Requiere estar autenticado. El nombre del proyecto es obligatorio.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        project_name: { type: 'STRING' as const, description: 'Nombre del proyecto (obligatorio).' },
        project_key: { type: 'STRING' as const, description: 'Clave corta del proyecto (máximo 5 letras, ej: "MKTG", "DEV"). Se genera automáticamente si no se especifica.' },
        team_id: { type: 'STRING' as const, description: 'ID del equipo al que pertenece el proyecto.' },
        description: { type: 'STRING' as const, description: 'Descripción del proyecto.' },
        priority_level: { type: 'STRING' as const, description: 'Nivel de prioridad: "urgent", "high", "medium", "low", "none". Por defecto "medium".' },
        start_date: { type: 'STRING' as const, description: 'Fecha de inicio en formato YYYY-MM-DD.' },
        target_date: { type: 'STRING' as const, description: 'Fecha objetivo de finalización en formato YYYY-MM-DD.' },
      },
      required: ['project_name'],
    },
  },
  {
    name: 'iris_update_project_status',
    description: 'Cambia el estado de un proyecto existente en Project Hub. Los estados posibles son: planning, active, on_hold, completed, cancelled, archived.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        project_id: { type: 'STRING' as const, description: 'ID del proyecto a actualizar (obligatorio).' },
        new_status: { type: 'STRING' as const, description: 'Nuevo estado del proyecto: "planning", "active", "on_hold", "completed", "cancelled", "archived".' },
      },
      required: ['project_id', 'new_status'],
    },
  },
  {
    name: 'iris_get_statuses',
    description: 'Lista los estados y prioridades disponibles para un equipo en Project Hub. Útil antes de crear tareas o cambiar estados.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        team_id: { type: 'STRING' as const, description: 'ID del equipo para obtener sus estados configurados.' },
      },
      required: ['team_id'],
    },
  },
];
