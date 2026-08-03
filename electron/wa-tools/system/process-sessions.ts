export const PROCESS_SESSION_TOOLS = [
  {
    name: 'list_process_sessions',
    description: 'Lista las sesiones administradas por Pulse (terminales, comandos en segundo plano, Claude Code y aplicaciones lanzadas) con su estado actual.',
    parameters: { type: 'OBJECT' as const, properties: {} },
  },
  {
    name: 'poll_process_session',
    description: 'Consulta una sesion administrada por session_id. Devuelve estado, pid, salida reciente stdout/stderr y metadatos.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        session_id: { type: 'STRING' as const, description: 'ID de la sesion a consultar.' },
      },
      required: ['session_id'],
    },
  },
  {
    name: 'kill_process_session',
    description: 'Termina una sesion administrada por Pulse usando su session_id. REQUIERE confirmacion.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        session_id: { type: 'STRING' as const, description: 'ID de la sesion a terminar.' },
      },
      required: ['session_id'],
    },
  },
];
