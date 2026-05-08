export const REMOTE_NODE_SESSION_TOOLS = [
  {
    name: 'list_remote_node_process_sessions',
    description: 'Lista sesiones administradas activas en un nodo remoto.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        node_id: { type: 'STRING' as const, description: 'ID del nodo remoto.' },
      },
      required: ['node_id'],
    },
  },
  {
    name: 'poll_remote_node_process_session',
    description: 'Consulta el estado de una sesion remota por session_id.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        node_id: { type: 'STRING' as const, description: 'ID del nodo remoto.' },
        session_id: { type: 'STRING' as const, description: 'ID de la sesion remota.' },
      },
      required: ['node_id', 'session_id'],
    },
  },
  {
    name: 'kill_remote_node_process_session',
    description: 'Termina una sesion administrada en un nodo remoto. REQUIERE confirmacion.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        node_id: { type: 'STRING' as const, description: 'ID del nodo remoto.' },
        session_id: { type: 'STRING' as const, description: 'ID de la sesion remota.' },
      },
      required: ['node_id', 'session_id'],
    },
  },
];
