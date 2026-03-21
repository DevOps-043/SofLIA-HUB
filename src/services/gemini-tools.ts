/**
 * Gemini function-calling tool definitions for SofLIA renderer chat.
 */

export const COMPUTER_USE_TOOLS = {
  functionDeclarations: [
    {
      name: 'list_directory',
      description: 'Lista archivos y carpetas en un directorio del sistema.',
      parameters: {
        type: 'OBJECT',
        properties: {
          path: { type: 'STRING', description: 'Ruta del directorio.' },
          show_hidden: { type: 'BOOLEAN', description: 'Si es true, incluye elementos ocultos.' },
        },
        required: ['path'],
      },
    },
    {
      name: 'read_file',
      description: 'Lee el contenido de un archivo de texto.',
      parameters: {
        type: 'OBJECT',
        properties: {
          path: { type: 'STRING', description: 'Ruta completa del archivo.' },
        },
        required: ['path'],
      },
    },
    {
      name: 'write_file',
      description: 'Crea o sobrescribe un archivo de texto.',
      parameters: {
        type: 'OBJECT',
        properties: {
          path: { type: 'STRING', description: 'Ruta completa del archivo.' },
          content: { type: 'STRING', description: 'Contenido a escribir.' },
        },
        required: ['path', 'content'],
      },
    },
    {
      name: 'create_directory',
      description: 'Crea una carpeta nueva.',
      parameters: {
        type: 'OBJECT',
        properties: {
          path: { type: 'STRING', description: 'Ruta completa de la carpeta.' },
        },
        required: ['path'],
      },
    },
    {
      name: 'move_item',
      description: 'Mueve o renombra un archivo o carpeta.',
      parameters: {
        type: 'OBJECT',
        properties: {
          source_path: { type: 'STRING', description: 'Ruta origen.' },
          destination_path: { type: 'STRING', description: 'Ruta destino.' },
        },
        required: ['source_path', 'destination_path'],
      },
    },
    {
      name: 'copy_item',
      description: 'Copia un archivo o carpeta a otra ubicacion.',
      parameters: {
        type: 'OBJECT',
        properties: {
          source_path: { type: 'STRING', description: 'Ruta origen.' },
          destination_path: { type: 'STRING', description: 'Ruta destino.' },
        },
        required: ['source_path', 'destination_path'],
      },
    },
    {
      name: 'delete_item',
      description: 'Envia un archivo o carpeta a la papelera. Requiere confirmacion.',
      parameters: {
        type: 'OBJECT',
        properties: {
          path: { type: 'STRING', description: 'Ruta del archivo o carpeta.' },
        },
        required: ['path'],
      },
    },
    {
      name: 'get_file_info',
      description: 'Obtiene informacion detallada sobre un archivo o carpeta.',
      parameters: {
        type: 'OBJECT',
        properties: {
          path: { type: 'STRING', description: 'Ruta del archivo o carpeta.' },
        },
        required: ['path'],
      },
    },
    {
      name: 'search_files',
      description: 'Busca archivos y carpetas por nombre dentro de un directorio.',
      parameters: {
        type: 'OBJECT',
        properties: {
          directory: { type: 'STRING', description: 'Directorio donde buscar.' },
          pattern: { type: 'STRING', description: 'Texto a buscar en los nombres.' },
        },
        required: ['pattern'],
      },
    },
    {
      name: 'list_directory_summary',
      description: 'Resume un directorio grande antes de organizarlo.',
      parameters: {
        type: 'OBJECT',
        properties: {
          path: { type: 'STRING', description: 'Ruta del directorio.' },
          recursive: { type: 'BOOLEAN', description: 'Si es true, analiza subcarpetas.' },
          max_depth: { type: 'NUMBER', description: 'Profundidad maxima para analisis recursivo. Opcional.' },
        },
        required: ['path'],
      },
    },
    {
      name: 'organize_files',
      description: 'Organiza los archivos de un directorio por extension, tipo, fecha o reglas personalizadas.',
      parameters: {
        type: 'OBJECT',
        properties: {
          path: { type: 'STRING', description: 'Ruta del directorio a organizar.' },
          mode: { type: 'STRING', description: 'extension, type, date o custom.' },
          rules: { type: 'OBJECT', description: 'Mapa extension a carpeta para el modo custom.' },
          dry_run: { type: 'BOOLEAN', description: 'Si es true, solo devuelve la simulacion.' },
          recursive: { type: 'BOOLEAN', description: 'Si es true, incluye archivos en subcarpetas.' },
        },
        required: ['path'],
      },
    },
    {
      name: 'batch_move_files',
      description: 'Mueve en lote archivos entre dos directorios.',
      parameters: {
        type: 'OBJECT',
        properties: {
          source_directory: { type: 'STRING', description: 'Directorio origen.' },
          destination_directory: { type: 'STRING', description: 'Directorio destino.' },
          extensions: {
            type: 'ARRAY',
            items: { type: 'STRING' },
            description: 'Lista opcional de extensiones sin punto.',
          },
          pattern: { type: 'STRING', description: 'Texto opcional para filtrar nombres.' },
          recursive: { type: 'BOOLEAN', description: 'Si es true, incluye subcarpetas del origen.' },
        },
        required: ['source_directory', 'destination_directory'],
      },
    },
    {
      name: 'undo_last_file_operation',
      description: 'Revierte la ultima operacion masiva de archivos o una operacion especifica por su operation_id.',
      parameters: {
        type: 'OBJECT',
        properties: {
          operation_id: { type: 'STRING', description: 'ID opcional de la operacion a revertir.' },
        },
      },
    },
    {
      name: 'execute_command',
      description: 'Ejecuta un comando del sistema. Requiere confirmacion.',
      parameters: {
        type: 'OBJECT',
        properties: {
          command: { type: 'STRING', description: 'Comando a ejecutar.' },
        },
        required: ['command'],
      },
    },
    {
      name: 'open_application',
      description: 'Abre un archivo o aplicación. Acepta ruta completa o nombre común de la app y en Windows intenta resolver ejecutables instalados, accesos directos y alias del sistema.',
      parameters: {
        type: 'OBJECT',
        properties: {
          path: { type: 'STRING', description: 'Ruta completa o nombre común de la aplicación o archivo.' },
        },
        required: ['path'],
      },
    },
    {
      name: 'open_url',
      description: 'Abre una URL en el navegador predeterminado.',
      parameters: {
        type: 'OBJECT',
        properties: {
          url: { type: 'STRING', description: 'URL completa, incluyendo https://.' },
        },
        required: ['url'],
      },
    },
    {
      name: 'run_background_command',
      description: 'Ejecuta un comando oculto en segundo plano y devuelve session_id para seguimiento.',
      parameters: {
        type: 'OBJECT',
        properties: {
          command: { type: 'STRING', description: 'Comando a ejecutar.' },
          working_directory: { type: 'STRING', description: 'Directorio de trabajo opcional.' },
          title: { type: 'STRING', description: 'Etiqueta corta opcional para la sesion.' },
        },
        required: ['command'],
      },
    },
    {
      name: 'list_process_sessions',
      description: 'Lista las sesiones administradas por SofLIA y su estado.',
      parameters: {
        type: 'OBJECT',
        properties: {},
      },
    },
    {
      name: 'poll_process_session',
      description: 'Consulta una sesion administrada por session_id y devuelve su salida reciente.',
      parameters: {
        type: 'OBJECT',
        properties: {
          session_id: { type: 'STRING', description: 'ID de la sesion a consultar.' },
        },
        required: ['session_id'],
      },
    },
    {
      name: 'kill_process_session',
      description: 'Termina una sesion administrada por SofLIA usando su session_id.',
      parameters: {
        type: 'OBJECT',
        properties: {
          session_id: { type: 'STRING', description: 'ID de la sesion a terminar.' },
        },
        required: ['session_id'],
      },
    },
    {
      name: 'get_background_host_status',
      description: 'Obtiene el estado del host en segundo plano de SofLIA.',
      parameters: {
        type: 'OBJECT',
        properties: {},
      },
    },
    {
      name: 'repair_background_host',
      description: 'Reaplica la configuracion del host en segundo plano de SofLIA.',
      parameters: {
        type: 'OBJECT',
        properties: {},
      },
    },
    {
      name: 'get_system_info',
      description: 'Obtiene informacion del sistema y rutas base del usuario.',
      parameters: {
        type: 'OBJECT',
        properties: {},
      },
    },
    {
      name: 'clipboard_read',
      description: 'Lee el contenido del portapapeles.',
      parameters: {
        type: 'OBJECT',
        properties: {},
      },
    },
    {
      name: 'clipboard_write',
      description: 'Escribe texto en el portapapeles.',
      parameters: {
        type: 'OBJECT',
        properties: {
          text: { type: 'STRING', description: 'Texto a copiar.' },
        },
        required: ['text'],
      },
    },
    {
      name: 'take_screenshot',
      description: 'Captura una imagen de la pantalla actual.',
      parameters: {
        type: 'OBJECT',
        properties: {},
      },
    },
    {
      name: 'use_computer',
      description: 'Ejecuta una tarea autonoma de computer use en backend browser, uia o desktop. El backend uia puede escalar automaticamente a desktop si no logra verificar cambios.',
      parameters: {
        type: 'OBJECT',
        properties: {
          task: { type: 'STRING', description: 'Descripcion detallada de la tarea.' },
          max_steps: { type: 'NUMBER', description: 'Maximo de pasos.' },
          backend: { type: 'STRING', description: 'Opcional: auto, browser, uia o desktop.' },
          start_url: { type: 'STRING', description: 'URL inicial para una tarea web. Opcional.' },
          browser_profile: { type: 'STRING', description: 'Perfil persistente opcional para browser_web.' },
          browser_isolated: { type: 'BOOLEAN', description: 'Si es true, fuerza una sesion web aislada.' },
          reset_browser_profile: { type: 'BOOLEAN', description: 'Si es true, limpia el perfil web indicado antes de ejecutar.' },
        },
        required: ['task'],
      },
    },
    {
      name: 'list_browser_profiles',
      description: 'Lista los perfiles persistentes disponibles para browser_web.',
      parameters: {
        type: 'OBJECT',
        properties: {},
      },
    },
    {
      name: 'reset_browser_profile',
      description: 'Borra un perfil persistente de browser_web.',
      parameters: {
        type: 'OBJECT',
        properties: {
          profile_id: { type: 'STRING', description: 'ID del perfil a limpiar.' },
        },
        required: ['profile_id'],
      },
    },
    {
      name: 'get_remote_node_host_status',
      description: 'Obtiene el estado del host de nodo remoto local.',
      parameters: {
        type: 'OBJECT',
        properties: {},
      },
    },
    {
      name: 'configure_remote_node_host',
      description: 'Configura el host remoto local de SofLIA.',
      parameters: {
        type: 'OBJECT',
        properties: {
          enabled: { type: 'BOOLEAN', description: 'Activa o desactiva el host remoto.' },
          bind_address: { type: 'STRING', description: 'Direccion de escucha.' },
          port: { type: 'NUMBER', description: 'Puerto TCP.' },
          node_name: { type: 'STRING', description: 'Nombre legible del nodo.' },
          advertise_url: { type: 'STRING', description: 'URL publica opcional.' },
          rotate_token: { type: 'BOOLEAN', description: 'Si es true, regenera el token.' },
        },
      },
    },
    {
      name: 'list_remote_nodes',
      description: 'Lista los nodos remotos registrados.',
      parameters: {
        type: 'OBJECT',
        properties: {},
      },
    },
    {
      name: 'register_remote_node',
      description: 'Registra o actualiza un nodo remoto.',
      parameters: {
        type: 'OBJECT',
        properties: {
          node_id: { type: 'STRING', description: 'ID opcional del nodo.' },
          name: { type: 'STRING', description: 'Nombre del nodo remoto.' },
          base_url: { type: 'STRING', description: 'URL base del nodo remoto.' },
          token: { type: 'STRING', description: 'Token del nodo remoto.' },
          enabled: { type: 'BOOLEAN', description: 'Si es false, queda deshabilitado.' },
        },
        required: ['name', 'base_url', 'token'],
      },
    },
    {
      name: 'remove_remote_node',
      description: 'Elimina un nodo remoto registrado.',
      parameters: {
        type: 'OBJECT',
        properties: {
          node_id: { type: 'STRING', description: 'ID del nodo remoto.' },
        },
        required: ['node_id'],
      },
    },
    {
      name: 'test_remote_node',
      description: 'Prueba conectividad y capacidades de un nodo remoto.',
      parameters: {
        type: 'OBJECT',
        properties: {
          node_id: { type: 'STRING', description: 'ID del nodo remoto.' },
        },
        required: ['node_id'],
      },
    },
    {
      name: 'open_application_on_node',
      description: 'Abre una aplicacion en un nodo remoto.',
      parameters: {
        type: 'OBJECT',
        properties: {
          node_id: { type: 'STRING', description: 'ID del nodo remoto.' },
          path: { type: 'STRING', description: 'Ruta o nombre de la aplicacion.' },
        },
        required: ['node_id', 'path'],
      },
    },
    {
      name: 'run_background_command_on_node',
      description: 'Ejecuta un comando en segundo plano en un nodo remoto.',
      parameters: {
        type: 'OBJECT',
        properties: {
          node_id: { type: 'STRING', description: 'ID del nodo remoto.' },
          command: { type: 'STRING', description: 'Comando a ejecutar.' },
          working_directory: { type: 'STRING', description: 'Directorio de trabajo opcional.' },
          title: { type: 'STRING', description: 'Etiqueta de la sesion.' },
        },
        required: ['node_id', 'command'],
      },
    },
    {
      name: 'use_computer_on_node',
      description: 'Ejecuta una tarea de automation en un nodo remoto.',
      parameters: {
        type: 'OBJECT',
        properties: {
          node_id: { type: 'STRING', description: 'ID del nodo remoto.' },
          task: { type: 'STRING', description: 'Descripcion detallada de la tarea.' },
          max_steps: { type: 'NUMBER', description: 'Maximo de pasos.' },
          backend: { type: 'STRING', description: 'Opcional: auto, browser, uia o desktop.' },
          start_url: { type: 'STRING', description: 'URL inicial opcional.' },
          browser_profile: { type: 'STRING', description: 'Perfil persistente opcional del browser remoto.' },
          browser_isolated: { type: 'BOOLEAN', description: 'Si es true, fuerza sesion web aislada remota.' },
          reset_browser_profile: { type: 'BOOLEAN', description: 'Si es true, limpia el perfil remoto antes de ejecutar.' },
        },
        required: ['node_id', 'task'],
      },
    },
    {
      name: 'list_remote_node_process_sessions',
      description: 'Lista sesiones administradas de un nodo remoto.',
      parameters: {
        type: 'OBJECT',
        properties: {
          node_id: { type: 'STRING', description: 'ID del nodo remoto.' },
        },
        required: ['node_id'],
      },
    },
    {
      name: 'poll_remote_node_process_session',
      description: 'Consulta una sesion remota por session_id.',
      parameters: {
        type: 'OBJECT',
        properties: {
          node_id: { type: 'STRING', description: 'ID del nodo remoto.' },
          session_id: { type: 'STRING', description: 'ID de la sesion remota.' },
        },
        required: ['node_id', 'session_id'],
      },
    },
    {
      name: 'kill_remote_node_process_session',
      description: 'Termina una sesion remota.',
      parameters: {
        type: 'OBJECT',
        properties: {
          node_id: { type: 'STRING', description: 'ID del nodo remoto.' },
          session_id: { type: 'STRING', description: 'ID de la sesion remota.' },
        },
        required: ['node_id', 'session_id'],
      },
    },
    {
      name: 'get_email_config',
      description: 'Verifica si el email SMTP local esta configurado.',
      parameters: {
        type: 'OBJECT',
        properties: {},
      },
    },
    {
      name: 'configure_email',
      description: 'Configura el email SMTP local del usuario.',
      parameters: {
        type: 'OBJECT',
        properties: {
          email: { type: 'STRING', description: 'Direccion de email del usuario.' },
          password: { type: 'STRING', description: 'Contrasena de aplicacion.' },
        },
        required: ['email', 'password'],
      },
    },
    {
      name: 'send_email',
      description: 'Envia un email usando la configuracion SMTP local. Requiere confirmacion.',
      parameters: {
        type: 'OBJECT',
        properties: {
          to: { type: 'STRING', description: 'Direccion de email del destinatario.' },
          subject: { type: 'STRING', description: 'Asunto del email.' },
          body: { type: 'STRING', description: 'Cuerpo del email.' },
          attachment_paths: {
            type: 'ARRAY',
            items: { type: 'STRING' },
            description: 'Rutas completas de archivos a adjuntar.',
          },
          is_html: { type: 'BOOLEAN', description: 'Si es true, el body se trata como HTML.' },
        },
        required: ['to', 'subject', 'body'],
      },
    },
  ],
};

export const WHATSAPP_SEND_FILE_TOOL = {
  name: 'whatsapp_send_file',
  description: 'Envia un archivo de la computadora al usuario por WhatsApp.',
  parameters: {
    type: 'OBJECT',
    properties: {
      file_path: { type: 'STRING', description: 'Ruta completa del archivo a enviar.' },
      caption: { type: 'STRING', description: 'Texto opcional del archivo.' },
    },
    required: ['file_path'],
  },
};

export const NATIVE_AI_TOOLS = {
  functionDeclarations: [
    {
      name: 'generate_image',
      description: 'Genera una imagen con IA a partir de una descripcion en texto.',
      parameters: {
        type: 'OBJECT',
        properties: {
          prompt: {
            type: 'STRING',
            description: 'Descripcion detallada en ingles de la imagen deseada.',
          },
        },
        required: ['prompt'],
      },
    },
  ],
};

export const PROJECT_HUB_TOOLS = {
  functionDeclarations: [
    {
      name: 'delete_iris_project',
      description: 'Elimina un proyecto de Project Hub (IRIS) de manera permanente.',
      parameters: {
        type: 'OBJECT',
        properties: {
          project_id: { type: 'STRING', description: 'ID del proyecto.' },
        },
        required: ['project_id'],
      },
    },
    {
      name: 'get_iris_teams',
      description: 'Lista los equipos disponibles en IRIS.',
      parameters: {
        type: 'OBJECT',
        properties: {},
      },
    },
    {
      name: 'get_iris_projects',
      description: 'Lista los proyectos disponibles en IRIS. Puede filtrar por equipo.',
      parameters: {
        type: 'OBJECT',
        properties: {
          team_id: { type: 'STRING', description: 'ID del equipo. Opcional.' },
          team_name: { type: 'STRING', description: 'Nombre o slug del equipo. Opcional.' },
        },
      },
    },
    {
      name: 'get_iris_team_members',
      description: 'Lista los miembros de un equipo de IRIS para asignar tareas sin adivinar el responsable.',
      parameters: {
        type: 'OBJECT',
        properties: {
          team_id: { type: 'STRING', description: 'ID del equipo.' },
          team_name: { type: 'STRING', description: 'Nombre o slug del equipo.' },
        },
      },
    },
    {
      name: 'create_iris_project',
      description: 'Crea un nuevo proyecto en Project Hub (IRIS). Si no conoces el ID del equipo, usa team_name.',
      parameters: {
        type: 'OBJECT',
        properties: {
          project_name: { type: 'STRING', description: 'Nombre del proyecto.' },
          team_id: { type: 'STRING', description: 'ID del equipo. Opcional.' },
          team_name: { type: 'STRING', description: 'Nombre o slug del equipo. Opcional.' },
          project_description: { type: 'STRING', description: 'Descripcion del proyecto.' },
          project_key: { type: 'STRING', description: 'Clave corta del proyecto. Opcional; se genera automaticamente si falta.' },
        },
        required: ['project_name'],
      },
    },
    {
      name: 'create_iris_issue',
      description: 'Crea una nueva tarea en Project Hub (IRIS). No inventes IDs: resuelve antes equipo, proyecto y responsable.',
      parameters: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING', description: 'Titulo de la tarea.' },
          description: { type: 'STRING', description: 'Descripcion detallada de la tarea.' },
          team_id: { type: 'STRING', description: 'ID del equipo. Opcional si envias team_name o si el proyecto ya define el equipo.' },
          team_name: { type: 'STRING', description: 'Nombre o slug del equipo. Opcional.' },
          project_id: { type: 'STRING', description: 'ID del proyecto. Opcional.' },
          project_name: { type: 'STRING', description: 'Nombre o key del proyecto. Opcional.' },
          status_id: { type: 'STRING', description: 'ID de estado. Opcional.' },
          status_name: { type: 'STRING', description: 'Nombre del estado. Opcional.' },
          priority_id: { type: 'STRING', description: 'ID de prioridad. Opcional.' },
          priority_name: { type: 'STRING', description: 'Nombre de prioridad. Opcional.' },
          assignee_id: { type: 'STRING', description: 'ID del usuario asignado. Opcional.' },
          assignee_name: { type: 'STRING', description: 'Nombre, username o email del responsable. Opcional.' },
        },
        required: ['title'],
      },
    },
    {
      name: 'get_iris_statuses',
      description: 'Obtiene los estados disponibles para un equipo de IRIS.',
      parameters: {
        type: 'OBJECT',
        properties: {
          team_id: { type: 'STRING', description: 'ID del equipo.' },
          team_name: { type: 'STRING', description: 'Nombre o slug del equipo.' },
        },
      },
    },
    {
      name: 'get_iris_priorities',
      description: 'Obtiene las prioridades disponibles en IRIS.',
      parameters: {
        type: 'OBJECT',
        properties: {},
      },
    },
    {
      name: 'get_current_user_id',
      description: 'Obtiene el ID del usuario actual de la sesion.',
      parameters: {
        type: 'OBJECT',
        properties: {},
      },
    },
  ],
};

export const GOOGLE_WORKSPACE_TOOLS = {
  functionDeclarations: [
    {
      name: 'google_calendar_get_events',
      description: 'Obtiene los eventos del calendario del usuario para una fecha.',
      parameters: {
        type: 'OBJECT',
        properties: {
          date: {
            type: 'STRING',
            description: 'Fecha en formato ISO YYYY-MM-DD. Opcional.',
          },
        },
      },
    },
    {
      name: 'google_calendar_create',
      description: 'Crea un nuevo evento en Google Calendar.',
      parameters: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING', description: 'Titulo del evento.' },
          start: { type: 'STRING', description: 'Fecha y hora de inicio ISO 8601.' },
          end: { type: 'STRING', description: 'Fecha y hora de fin ISO 8601.' },
          description: { type: 'STRING', description: 'Descripcion del evento. Opcional.' },
          location: { type: 'STRING', description: 'Ubicacion del evento. Opcional.' },
        },
        required: ['title', 'start', 'end'],
      },
    },
    {
      name: 'google_calendar_delete',
      description: 'Elimina un evento del calendario por su ID.',
      parameters: {
        type: 'OBJECT',
        properties: {
          event_id: { type: 'STRING', description: 'ID del evento.' },
        },
        required: ['event_id'],
      },
    },
    {
      name: 'gmail_get_messages',
      description: 'Obtiene mensajes de Gmail con filtros, etiquetas y paginacion.',
      parameters: {
        type: 'OBJECT',
        properties: {
          query: { type: 'STRING', description: 'Filtro de busqueda de Gmail. Opcional.' },
          max_results: { type: 'NUMBER', description: 'Numero maximo de mensajes a obtener.' },
          label_ids: {
            type: 'ARRAY',
            items: { type: 'STRING' },
            description: 'IDs de etiquetas para filtrar mensajes. Opcional.',
          },
          page_token: {
            type: 'STRING',
            description: 'Cursor devuelto por una llamada anterior para continuar la paginacion. Opcional.',
          },
        },
      },
    },
    {
      name: 'gmail_read_message',
      description: 'Lee el contenido completo de un mensaje de Gmail por su ID.',
      parameters: {
        type: 'OBJECT',
        properties: {
          message_id: { type: 'STRING', description: 'ID del mensaje de Gmail.' },
        },
        required: ['message_id'],
      },
    },
    {
      name: 'gmail_send',
      description: 'Envia un correo desde la cuenta de Gmail conectada del usuario.',
      parameters: {
        type: 'OBJECT',
        properties: {
          to: { type: 'STRING', description: 'Correo del destinatario.' },
          subject: { type: 'STRING', description: 'Asunto del correo.' },
          body: { type: 'STRING', description: 'Cuerpo del correo.' },
          is_html: { type: 'BOOLEAN', description: 'Si es true, interpreta el body como HTML.' },
          attachment_paths: {
            type: 'ARRAY',
            items: { type: 'STRING' },
            description: 'Rutas locales de archivos a adjuntar. Opcional.',
          },
        },
        required: ['to', 'subject', 'body'],
      },
    },
    {
      name: 'gmail_get_labels',
      description: 'Lista las etiquetas de Gmail disponibles.',
      parameters: {
        type: 'OBJECT',
        properties: {},
      },
    },
    {
      name: 'gmail_create_label',
      description: 'Crea una nueva etiqueta de Gmail.',
      parameters: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING', description: 'Nombre de la etiqueta.' },
        },
        required: ['name'],
      },
    },
    {
      name: 'gmail_delete_label',
      description: 'Elimina una etiqueta de Gmail por su ID.',
      parameters: {
        type: 'OBJECT',
        properties: {
          label_id: { type: 'STRING', description: 'ID de la etiqueta.' },
        },
        required: ['label_id'],
      },
    },
    {
      name: 'gmail_preview_organization',
      description: 'Analiza el inbox de Gmail y genera un plan determinista de organizacion por remitente o empresa sin modificar correos todavia.',
      parameters: {
        type: 'OBJECT',
        properties: {
          query: { type: 'STRING', description: 'Filtro opcional de Gmail. Por defecto usa in:inbox.' },
          max_messages: { type: 'NUMBER', description: 'Maximo de correos a analizar para el preview.' },
          min_group_size: { type: 'NUMBER', description: 'Tamano minimo de grupo para proponer una etiqueta.' },
          remove_from_inbox: { type: 'BOOLEAN', description: 'Si es true, el plan propondra sacar los correos del inbox al aplicar.' },
          page_limit: { type: 'NUMBER', description: 'Numero maximo de paginas de Gmail a recorrer en el preview.' },
        },
      },
    },
    {
      name: 'gmail_apply_organization_plan',
      description: 'Aplica un plan de organizacion de Gmail generado previamente por gmail_preview_organization.',
      parameters: {
        type: 'OBJECT',
        properties: {
          plan_id: { type: 'STRING', description: 'ID del plan generado en el preview.' },
          remove_from_inbox: { type: 'BOOLEAN', description: 'Opcional. Sobrescribe si al aplicar se quitan los correos del inbox.' },
        },
        required: ['plan_id'],
      },
    },
    {
      name: 'gmail_undo_organization_plan',
      description: 'Revierte un plan de organizacion de Gmail previamente aplicado. Si no se envia plan_id, intenta revertir el ultimo plan aplicado.',
      parameters: {
        type: 'OBJECT',
        properties: {
          plan_id: { type: 'STRING', description: 'Opcional. ID del plan aplicado que se quiere revertir. Si se omite, usa el ultimo plan aplicado.' },
        },
      },
    },
    {
      name: 'gmail_modify_labels',
      description: 'Agrega o quita etiquetas de un correo individual.',
      parameters: {
        type: 'OBJECT',
        properties: {
          message_id: { type: 'STRING', description: 'ID del correo.' },
          add_labels: {
            type: 'ARRAY',
            items: { type: 'STRING' },
            description: 'Etiquetas o IDs a agregar.',
          },
          remove_labels: {
            type: 'ARRAY',
            items: { type: 'STRING' },
            description: 'Etiquetas o IDs a quitar.',
          },
        },
        required: ['message_id'],
      },
    },
    {
      name: 'gmail_batch_empty_label',
      description: 'Vacia una etiqueta completa de Gmail y opcionalmente la elimina.',
      parameters: {
        type: 'OBJECT',
        properties: {
          label_id: { type: 'STRING', description: 'ID de la etiqueta.' },
          delete_label: { type: 'BOOLEAN', description: 'Si es true, elimina la etiqueta despues.' },
        },
        required: ['label_id'],
      },
    },
    {
      name: 'gmail_empty_all_labels',
      description: 'Vacia y elimina todas las etiquetas creadas por el usuario en Gmail.',
      parameters: {
        type: 'OBJECT',
        properties: {},
      },
    },
    {
      name: 'drive_list_files',
      description: 'Lista los archivos recientes en Google Drive.',
      parameters: {
        type: 'OBJECT',
        properties: {
          query: { type: 'STRING', description: 'Busqueda de Drive. Opcional.' },
          max_results: { type: 'NUMBER', description: 'Numero maximo de archivos. Opcional.' },
        },
      },
    },
    {
      name: 'drive_search',
      description: 'Busca archivos en Google Drive por nombre o texto relevante.',
      parameters: {
        type: 'OBJECT',
        properties: {
          query: { type: 'STRING', description: 'Texto de busqueda.' },
        },
        required: ['query'],
      },
    },
    {
      name: 'drive_download',
      description: 'Descarga un archivo de Google Drive a una ruta local.',
      parameters: {
        type: 'OBJECT',
        properties: {
          file_id: { type: 'STRING', description: 'ID del archivo en Drive.' },
          destination_path: { type: 'STRING', description: 'Ruta local destino.' },
          format: { type: 'STRING', description: 'Opcional: text o pdf.' },
        },
        required: ['file_id', 'destination_path'],
      },
    },
    {
      name: 'drive_upload',
      description: 'Sube un archivo local a Google Drive.',
      parameters: {
        type: 'OBJECT',
        properties: {
          file_path: { type: 'STRING', description: 'Ruta local del archivo.' },
          folder_id: { type: 'STRING', description: 'ID opcional de carpeta destino.' },
          name: { type: 'STRING', description: 'Nombre opcional del archivo en Drive.' },
        },
        required: ['file_path'],
      },
    },
    {
      name: 'drive_create_folder',
      description: 'Crea una carpeta en Google Drive.',
      parameters: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING', description: 'Nombre de la carpeta.' },
          parent_id: { type: 'STRING', description: 'ID opcional de carpeta padre.' },
        },
        required: ['name'],
      },
    },
    {
      name: 'google_calendar_get_connections',
      description: 'Verifica que calendarios estan conectados antes de operar sobre ellos.',
      parameters: {
        type: 'OBJECT',
        properties: {},
      },
    },
  ],
};

export const COMPUTER_TOOL_NAMES = new Set(
  COMPUTER_USE_TOOLS.functionDeclarations.map(t => t.name)
);

export const PROJECT_HUB_TOOL_NAMES = new Set(
  PROJECT_HUB_TOOLS.functionDeclarations.map(t => t.name)
);

export const GOOGLE_WORKSPACE_TOOL_NAMES = new Set(
  GOOGLE_WORKSPACE_TOOLS.functionDeclarations.map(t => t.name)
);

export const NATIVE_AI_TOOL_NAMES = new Set(
  NATIVE_AI_TOOLS.functionDeclarations.map(t => t.name)
);
