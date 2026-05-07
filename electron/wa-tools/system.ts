/**
 * Tools de control de sistema y procesos.
 *
 * Cubre:
 *  - Información del sistema (`get_system_info`)
 *  - Listado/control de procesos (`list_processes`, `kill_process`)
 *  - Power management (`shutdown`, `restart`, `sleep`, `lock_session`, `cancel_shutdown`)
 *  - Audio/red (`set_volume`, `toggle_wifi`)
 *  - Ejecución de comandos (`execute_command`, `run_in_terminal`, `run_claude_code`,
 *    `run_background_command`)
 *  - Sesiones de proceso administradas (`list/poll/kill_process_session`)
 *  - Background host de SofLIA (`get/repair_background_host_status`)
 */

export const SYSTEM_TOOLS = [
  {
    name: 'get_system_info',
    description: 'Obtiene información del sistema: SO, CPU, RAM, disco, y las rutas del escritorio, documentos y descargas del usuario.',
    parameters: { type: 'OBJECT' as const, properties: {} },
  },
  {
    name: 'list_processes',
    description: 'Lista los procesos activos de la computadora con su nombre, PID, uso de CPU y memoria. Usa esto cuando el usuario pregunte qué programas están abiertos o qué está consumiendo recursos.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        sort_by: { type: 'STRING' as const, description: 'Ordenar por: "cpu", "memory" o "name". Por defecto "memory".' },
        top: { type: 'NUMBER' as const, description: 'Cantidad de procesos a mostrar. Por defecto 15.' },
      },
    },
  },
  {
    name: 'kill_process',
    description: 'Cierra/termina un proceso de la computadora por su nombre o PID. REQUIERE confirmación del usuario. Usa esto cuando el usuario pida cerrar un programa, matar un proceso, o forzar el cierre de algo.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        pid: { type: 'NUMBER' as const, description: 'ID del proceso a cerrar. Usa list_processes para obtener el PID.' },
        name: { type: 'STRING' as const, description: 'Nombre del proceso (ej: "chrome", "notepad"). Si se da nombre, cierra TODAS las instancias.' },
      },
    },
  },
  {
    name: 'lock_session',
    description: 'Bloquea la sesión de Windows (pantalla de bloqueo). REQUIERE confirmación. El usuario deberá ingresar su contraseña para desbloquear.',
    parameters: { type: 'OBJECT' as const, properties: {} },
  },
  {
    name: 'shutdown_computer',
    description: 'Apaga la computadora. Se programa con 60 segundos de espera para poder cancelar con cancel_shutdown. REQUIERE confirmación.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        delay_seconds: { type: 'NUMBER' as const, description: 'Segundos de espera antes de apagar. Por defecto 60.' },
      },
    },
  },
  {
    name: 'restart_computer',
    description: 'Reinicia la computadora. Se programa con 60 segundos de espera para poder cancelar con cancel_shutdown. REQUIERE confirmación.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        delay_seconds: { type: 'NUMBER' as const, description: 'Segundos de espera antes de reiniciar. Por defecto 60.' },
      },
    },
  },
  {
    name: 'sleep_computer',
    description: 'Pone la computadora en modo de suspensión (sleep). REQUIERE confirmación.',
    parameters: { type: 'OBJECT' as const, properties: {} },
  },
  {
    name: 'cancel_shutdown',
    description: 'Cancela un apagado o reinicio programado previamente con shutdown_computer o restart_computer.',
    parameters: { type: 'OBJECT' as const, properties: {} },
  },
  {
    name: 'set_volume',
    description: 'Ajusta el volumen del sistema. Puede subir, bajar o silenciar/desilenciar.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        level: { type: 'NUMBER' as const, description: 'Nivel de volumen de 0 a 100. Si se omite, usa la acción.' },
        action: { type: 'STRING' as const, description: '"mute" para silenciar, "unmute" para desilenciar, "up" para subir 10%, "down" para bajar 10%.' },
      },
    },
  },
  {
    name: 'toggle_wifi',
    description: 'Activa o desactiva la conexión Wi-Fi. REQUIERE confirmación.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        enable: { type: 'BOOLEAN' as const, description: 'true para activar Wi-Fi, false para desactivar.' },
      },
      required: ['enable'],
    },
  },
  {
    name: 'execute_command',
    description: 'Ejecuta un comando en la terminal del sistema (PowerShell en Windows). REQUIERE confirmación. Timeout de 30 segundos. Usa run_in_terminal para comandos de larga duración.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        command: { type: 'STRING' as const, description: 'Comando a ejecutar en PowerShell.' },
      },
      required: ['command'],
    },
  },
  {
    name: 'open_application',
    description: 'Abre una aplicación o archivo. Acepta ruta completa o nombre común de la app (por ejemplo "AnyDesk", "Excel", "Chrome"). En Windows intenta resolver ejecutables instalados, accesos directos y alias del sistema. REQUIERE confirmación.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        path: { type: 'STRING' as const, description: 'Ruta completa o nombre común de la aplicación o archivo a abrir.' },
      },
      required: ['path'],
    },
  },
  {
    name: 'run_in_terminal',
    description: 'Ejecuta un comando en una sesión administrada. Puede abrir una terminal visible o correr oculto en segundo plano, y devuelve session_id para seguimiento. Usa poll_process_session para revisar progreso. REQUIERE confirmación.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        command: { type: 'STRING' as const, description: 'Comando a ejecutar en la terminal. Ej: "npm run dev", "git pull && npm install", "claude \\"corrige los errores\\"" ' },
        working_directory: { type: 'STRING' as const, description: 'Directorio de trabajo. Si no se especifica, usa el home del usuario.' },
        keep_open: { type: 'BOOLEAN' as const, description: 'Si es true (defecto), la terminal queda abierta después de que el comando termine. Si es false, se cierra al terminar.' },
        visible_terminal: { type: 'BOOLEAN' as const, description: 'Si es true (defecto), abre una terminal visible. Si es false, ejecuta el comando oculto en segundo plano con logs administrados.' },
      },
      required: ['command'],
    },
  },
  {
    name: 'run_claude_code',
    description: 'Lanza Claude Code (claude CLI) en una sesión administrada y oculta en segundo plano. Devuelve session_id para seguir progreso con poll_process_session. REQUIERE confirmación.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        task: { type: 'STRING' as const, description: 'Tarea que Claude Code debe realizar. Ej: "Corrige todos los errores de TypeScript", "Implementa autenticación con JWT", "Agrega tests para el servicio de usuarios"' },
        project_directory: { type: 'STRING' as const, description: 'Directorio del proyecto. Si no se especifica, se intentará detectar automáticamente.' },
      },
      required: ['task'],
    },
  },
  {
    name: 'run_background_command',
    description: 'Ejecuta un comando oculto en segundo plano y guarda stdout/stderr para seguimiento. Devuelve session_id para usar con poll_process_session. REQUIERE confirmación.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        command: { type: 'STRING' as const, description: 'Comando que debe correr en segundo plano.' },
        working_directory: { type: 'STRING' as const, description: 'Directorio de trabajo opcional.' },
        title: { type: 'STRING' as const, description: 'Etiqueta corta opcional para identificar la sesión.' },
      },
      required: ['command'],
    },
  },
  {
    name: 'list_process_sessions',
    description: 'Lista las sesiones administradas por SofLIA (terminales, comandos en segundo plano, Claude Code y aplicaciones lanzadas) con su estado actual.',
    parameters: { type: 'OBJECT' as const, properties: {} },
  },
  {
    name: 'poll_process_session',
    description: 'Consulta una sesión administrada por session_id. Devuelve estado, pid, salida reciente stdout/stderr y metadatos.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        session_id: { type: 'STRING' as const, description: 'ID de la sesión a consultar.' },
      },
      required: ['session_id'],
    },
  },
  {
    name: 'kill_process_session',
    description: 'Termina una sesión administrada por SofLIA usando su session_id. REQUIERE confirmación.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        session_id: { type: 'STRING' as const, description: 'ID de la sesión a terminar.' },
      },
      required: ['session_id'],
    },
  },
  {
    name: 'get_background_host_status',
    description: 'Obtiene el estado del host en segundo plano de SofLIA: soporte, openAtLogin, schtasks, Startup fallback y modo de instalación.',
    parameters: { type: 'OBJECT' as const, properties: {} },
  },
  {
    name: 'repair_background_host',
    description: 'Repara o reaplica la configuración del host en segundo plano de SofLIA (login item, schtasks o Startup fallback). REQUIERE confirmación.',
    parameters: { type: 'OBJECT' as const, properties: {} },
  },
];
