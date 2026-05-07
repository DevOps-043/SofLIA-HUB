/**
 * Tools para gestión de nodos remotos de SofLIA.
 *
 * Permite al usuario operar instancias de SofLIA en otras máquinas (LAN o
 * remotas) desde un único punto. Casi todas las operaciones requieren
 * confirmación porque tocan máquinas físicas.
 */

export const REMOTE_NODE_TOOLS = [
  {
    name: 'get_remote_node_host_status',
    description: 'Obtiene el estado del host de nodo remoto de esta instancia de SofLIA.',
    parameters: { type: 'OBJECT' as const, properties: {} },
  },
  {
    name: 'configure_remote_node_host',
    description: 'Configura el host de nodo remoto de esta instancia. REQUIERE confirmaciÃ³n.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        enabled: { type: 'BOOLEAN' as const, description: 'Activa o desactiva el host remoto.' },
        bind_address: { type: 'STRING' as const, description: 'Direccion de escucha. Usa 127.0.0.1 para loopback o 0.0.0.0 para LAN.' },
        port: { type: 'NUMBER' as const, description: 'Puerto TCP del host remoto.' },
        node_name: { type: 'STRING' as const, description: 'Nombre legible del nodo.' },
        advertise_url: { type: 'STRING' as const, description: 'URL publica opcional para que otros nodos se conecten.' },
        rotate_token: { type: 'BOOLEAN' as const, description: 'Si es true, regenera el token del host remoto.' },
      },
    },
  },
  {
    name: 'list_remote_nodes',
    description: 'Lista los nodos remotos registrados.',
    parameters: { type: 'OBJECT' as const, properties: {} },
  },
  {
    name: 'register_remote_node',
    description: 'Registra o actualiza un nodo remoto de SofLIA. REQUIERE confirmaciÃ³n.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        node_id: { type: 'STRING' as const, description: 'ID opcional del nodo.' },
        name: { type: 'STRING' as const, description: 'Nombre del nodo remoto.' },
        base_url: { type: 'STRING' as const, description: 'URL base del nodo remoto. Ejemplo: http://192.168.1.50:47825' },
        token: { type: 'STRING' as const, description: 'Token del nodo remoto.' },
        enabled: { type: 'BOOLEAN' as const, description: 'Si es false, queda registrado pero deshabilitado.' },
      },
      required: ['name', 'base_url', 'token'],
    },
  },
  {
    name: 'remove_remote_node',
    description: 'Elimina un nodo remoto registrado. REQUIERE confirmaciÃ³n.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        node_id: { type: 'STRING' as const, description: 'ID del nodo remoto a eliminar.' },
      },
      required: ['node_id'],
    },
  },
  {
    name: 'test_remote_node',
    description: 'Prueba conectividad y capacidades de un nodo remoto.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        node_id: { type: 'STRING' as const, description: 'ID del nodo remoto.' },
      },
      required: ['node_id'],
    },
  },
  {
    name: 'open_application_on_node',
    description: 'Abre una aplicaciÃ³n en un nodo remoto. REQUIERE confirmaciÃ³n.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        node_id: { type: 'STRING' as const, description: 'ID del nodo remoto.' },
        path: { type: 'STRING' as const, description: 'Ruta o nombre de la aplicaciÃ³n a abrir.' },
      },
      required: ['node_id', 'path'],
    },
  },
  {
    name: 'run_background_command_on_node',
    description: 'Ejecuta un comando en segundo plano en un nodo remoto y devuelve session_id remoto. REQUIERE confirmaciÃ³n.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        node_id: { type: 'STRING' as const, description: 'ID del nodo remoto.' },
        command: { type: 'STRING' as const, description: 'Comando a ejecutar.' },
        working_directory: { type: 'STRING' as const, description: 'Directorio de trabajo opcional.' },
        title: { type: 'STRING' as const, description: 'Etiqueta opcional para la sesiÃ³n.' },
      },
      required: ['node_id', 'command'],
    },
  },
  {
    name: 'take_screenshot_on_node',
    description: 'Captura la pantalla actual de un nodo remoto. REQUIERE confirmacion.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        node_id: { type: 'STRING' as const, description: 'ID del nodo remoto.' },
        display_id: { type: 'STRING' as const, description: 'Display especifico opcional.' },
      },
      required: ['node_id'],
    },
  },
  {
    name: 'use_computer_on_node',
    description: 'Ejecuta una tarea de desktop/browser automation en un nodo remoto. REQUIERE confirmaciÃ³n.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        node_id: { type: 'STRING' as const, description: 'ID del nodo remoto.' },
        task: { type: 'STRING' as const, description: 'Descripcion detallada de la tarea.' },
        max_steps: { type: 'NUMBER' as const, description: 'Maximo de pasos opcional.' },
        backend: { type: 'STRING' as const, description: 'Opcional: auto, browser, uia o desktop.' },
        start_url: { type: 'STRING' as const, description: 'URL inicial opcional para backend browser.' },
        browser_profile: { type: 'STRING' as const, description: 'Perfil persistente opcional del browser remoto.' },
        browser_isolated: { type: 'BOOLEAN' as const, description: 'Si es true, fuerza sesion web aislada remota.' },
        reset_browser_profile: { type: 'BOOLEAN' as const, description: 'Si es true, limpia el perfil remoto antes de ejecutar.' },
      },
      required: ['node_id', 'task'],
    },
  },
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
    description: 'Consulta el estado de una sesiÃ³n remota por session_id.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        node_id: { type: 'STRING' as const, description: 'ID del nodo remoto.' },
        session_id: { type: 'STRING' as const, description: 'ID de la sesiÃ³n remota.' },
      },
      required: ['node_id', 'session_id'],
    },
  },
  {
    name: 'kill_remote_node_process_session',
    description: 'Termina una sesiÃ³n administrada en un nodo remoto. REQUIERE confirmaciÃ³n.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        node_id: { type: 'STRING' as const, description: 'ID del nodo remoto.' },
        session_id: { type: 'STRING' as const, description: 'ID de la sesiÃ³n remota.' },
      },
      required: ['node_id', 'session_id'],
    },
  },
];
