export const IRIS_TEAM_TOOLS = [
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
    name: 'iris_get_statuses',
    description: 'Lista los estados y prioridades disponibles para un equipo en Project Hub.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        team_id: { type: 'STRING' as const, description: 'ID del equipo para obtener sus estados configurados.' },
      },
      required: ['team_id'],
    },
  },
];
