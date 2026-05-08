export const REMOTE_NODE_ACTION_TOOLS = [
  {
    name: 'open_application_on_node',
    description: 'Abre una aplicacion en un nodo remoto. REQUIERE confirmacion.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        node_id: { type: 'STRING' as const, description: 'ID del nodo remoto.' },
        path: { type: 'STRING' as const, description: 'Ruta o nombre de la aplicacion a abrir.' },
      },
      required: ['node_id', 'path'],
    },
  },
  {
    name: 'run_background_command_on_node',
    description: 'Ejecuta un comando en segundo plano en un nodo remoto y devuelve session_id remoto. REQUIERE confirmacion.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        node_id: { type: 'STRING' as const, description: 'ID del nodo remoto.' },
        command: { type: 'STRING' as const, description: 'Comando a ejecutar.' },
        working_directory: { type: 'STRING' as const, description: 'Directorio de trabajo opcional.' },
        title: { type: 'STRING' as const, description: 'Etiqueta opcional para la sesion.' },
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
    description: 'Ejecuta una tarea de desktop/browser automation en un nodo remoto. REQUIERE confirmacion.',
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
];
