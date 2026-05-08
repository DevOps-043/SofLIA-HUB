export const IRIS_PROJECT_TOOLS = [
  {
    name: 'iris_get_projects',
    description: 'Lista los proyectos disponibles en Project Hub. Puede filtrar por equipo.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        team_id: { type: 'STRING' as const, description: 'Opcional. Filtrar por equipo especifico.' },
      },
    },
  },
  {
    name: 'iris_create_project',
    description: 'Crea un nuevo proyecto en Project Hub. Requiere estar autenticado. El nombre del proyecto es obligatorio.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        project_name: { type: 'STRING' as const, description: 'Nombre del proyecto.' },
        project_key: { type: 'STRING' as const, description: 'Clave corta del proyecto. Se genera automaticamente si no se especifica.' },
        team_id: { type: 'STRING' as const, description: 'ID del equipo al que pertenece el proyecto.' },
        description: { type: 'STRING' as const, description: 'Descripcion del proyecto.' },
        priority_level: { type: 'STRING' as const, description: 'Nivel de prioridad: urgent, high, medium, low o none.' },
        start_date: { type: 'STRING' as const, description: 'Fecha de inicio en formato YYYY-MM-DD.' },
        target_date: { type: 'STRING' as const, description: 'Fecha objetivo en formato YYYY-MM-DD.' },
      },
      required: ['project_name'],
    },
  },
  {
    name: 'iris_update_project_status',
    description: 'Cambia el estado de un proyecto existente en Project Hub.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        project_id: { type: 'STRING' as const, description: 'ID del proyecto a actualizar.' },
        new_status: { type: 'STRING' as const, description: 'Nuevo estado del proyecto.' },
      },
      required: ['project_id', 'new_status'],
    },
  },
];
