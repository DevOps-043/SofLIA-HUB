export const MANAGED_COMMAND_TOOLS = [
  {
    name: 'execute_command',
    description: 'Ejecuta un comando en la terminal del sistema (PowerShell en Windows). REQUIERE confirmacion. Timeout de 30 segundos. Usa run_in_terminal para comandos de larga duracion.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        command: { type: 'STRING' as const, description: 'Comando a ejecutar en PowerShell.' },
      },
      required: ['command'],
    },
  },
  {
    name: 'run_in_terminal',
    description: 'Ejecuta un comando en una sesion administrada. Puede abrir una terminal visible o correr oculto en segundo plano, y devuelve session_id para seguimiento. Usa poll_process_session para revisar progreso. REQUIERE confirmacion.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        command: { type: 'STRING' as const, description: 'Comando a ejecutar en la terminal. Ej: "npm run dev", "git pull && npm install", "claude \\"corrige los errores\\""' },
        working_directory: { type: 'STRING' as const, description: 'Directorio de trabajo. Si no se especifica, usa el home del usuario.' },
        keep_open: { type: 'BOOLEAN' as const, description: 'Si es true (defecto), la terminal queda abierta despues de que el comando termine. Si es false, se cierra al terminar.' },
        visible_terminal: { type: 'BOOLEAN' as const, description: 'Si es true (defecto), abre una terminal visible. Si es false, ejecuta el comando oculto en segundo plano con logs administrados.' },
      },
      required: ['command'],
    },
  },
  {
    name: 'run_claude_code',
    description: 'Lanza Claude Code (claude CLI) en una sesion administrada y oculta en segundo plano. Devuelve session_id para seguir progreso con poll_process_session. REQUIERE confirmacion.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        task: { type: 'STRING' as const, description: 'Tarea que Claude Code debe realizar. Ej: "Corrige todos los errores de TypeScript", "Implementa autenticacion con JWT", "Agrega tests para el servicio de usuarios"' },
        project_directory: { type: 'STRING' as const, description: 'Directorio del proyecto. Si no se especifica, se intentara detectar automaticamente.' },
      },
      required: ['task'],
    },
  },
  {
    name: 'run_background_command',
    description: 'Ejecuta un comando oculto en segundo plano y guarda stdout/stderr para seguimiento. Devuelve session_id para usar con poll_process_session. REQUIERE confirmacion.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        command: { type: 'STRING' as const, description: 'Comando que debe correr en segundo plano.' },
        working_directory: { type: 'STRING' as const, description: 'Directorio de trabajo opcional.' },
        title: { type: 'STRING' as const, description: 'Etiqueta corta opcional para identificar la sesion.' },
      },
      required: ['command'],
    },
  },
];
