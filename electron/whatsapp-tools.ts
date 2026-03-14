/**
 * WhatsApp Agent — Tool declarations and security sets.
 * Extraido de whatsapp-agent.ts para reducir el tamano del archivo principal.
 */

// --- Tool definitions for WhatsApp (OMNIPOTENT — no blocked tools) ---
export const BLOCKED_TOOLS_WA = new Set<string>([
  // Empty — SofLIA can do everything
]);

export const CONFIRM_TOOLS_WA = new Set([
  'delete_item',
  'send_email',
  'execute_command',
  'open_application',
  'kill_process',
  'lock_session',
  'shutdown_computer',
  'restart_computer',
  'sleep_computer',
  'toggle_wifi',
  'run_in_terminal',
  'run_claude_code',
  'whatsapp_send_to_contact',
  'gmail_send',
  'gmail_trash',
  'google_calendar_delete',
  'gchat_send_message',
  'organize_files',
  'batch_move_files',
]);

// Tools blocked in GROUP context (security: don't allow group members to control host)
export const GROUP_BLOCKED_TOOLS = new Set([
  'execute_command',
  'open_application',
  'kill_process',
  'lock_session',
  'shutdown_computer',
  'restart_computer',
  'sleep_computer',
  'toggle_wifi',
  'run_in_terminal',
  'run_claude_code',
  'use_computer',
  'delete_item',
  'write_file',
  'move_item',
  'clipboard_write',
  'clipboard_read',
  'organize_files',
  'batch_move_files',
]);

// ─── Tool declarations for Gemini (filtered for WhatsApp security) ─
export const WA_TOOL_DECLARATIONS = {
  functionDeclarations: [
    {
      name: 'list_directory',
      description: 'Lista todos los archivos y carpetas en un directorio del sistema del usuario.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          path: { type: 'STRING' as const, description: 'Ruta del directorio a listar.' },
          show_hidden: { type: 'BOOLEAN' as const, description: 'Si es true, muestra archivos ocultos.' },
        },
        required: ['path'],
      },
    },
    {
      name: 'read_file',
      description: 'Lee y devuelve el contenido de un archivo de texto. Máximo 1MB.',
      parameters: {
        type: 'OBJECT' as const,
        properties: { path: { type: 'STRING' as const, description: 'Ruta completa del archivo.' } },
        required: ['path'],
      },
    },
    {
      name: 'write_file',
      description: 'Crea o sobrescribe un archivo con contenido de texto.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          path: { type: 'STRING' as const, description: 'Ruta del archivo.' },
          content: { type: 'STRING' as const, description: 'Contenido a escribir.' },
        },
        required: ['path', 'content'],
      },
    },
    {
      name: 'create_directory',
      description: 'Crea una carpeta nueva.',
      parameters: {
        type: 'OBJECT' as const,
        properties: { path: { type: 'STRING' as const, description: 'Ruta de la carpeta.' } },
        required: ['path'],
      },
    },
    {
      name: 'move_item',
      description: 'Mueve o renombra un archivo o carpeta.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          source_path: { type: 'STRING' as const, description: 'Ruta actual.' },
          destination_path: { type: 'STRING' as const, description: 'Nueva ruta.' },
        },
        required: ['source_path', 'destination_path'],
      },
    },
    {
      name: 'copy_item',
      description: 'Copia un archivo o carpeta.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          source_path: { type: 'STRING' as const, description: 'Ruta origen.' },
          destination_path: { type: 'STRING' as const, description: 'Ruta destino.' },
        },
        required: ['source_path', 'destination_path'],
      },
    },
    {
      name: 'delete_item',
      description: 'Envía un archivo o carpeta a la papelera. REQUIERE confirmación del usuario via WhatsApp.',
      parameters: {
        type: 'OBJECT' as const,
        properties: { path: { type: 'STRING' as const, description: 'Ruta a eliminar.' } },
        required: ['path'],
      },
    },
    {
      name: 'get_file_info',
      description: 'Obtiene información de un archivo: tamaño, fechas, tipo.',
      parameters: {
        type: 'OBJECT' as const,
        properties: { path: { type: 'STRING' as const, description: 'Ruta del archivo.' } },
        required: ['path'],
      },
    },
    {
      name: 'search_files',
      description: 'Busca archivos por nombre en un directorio.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          directory: { type: 'STRING' as const, description: 'Directorio donde buscar.' },
          pattern: { type: 'STRING' as const, description: 'Patrón de texto a buscar.' },
        },
        required: ['pattern'],
      },
    },
    // ─── Batch File Operations ────────────────────────────────────
    {
      name: 'organize_files',
      description: 'Organiza TODOS los archivos de un directorio en subcarpetas automáticamente según su extensión o tipo. Modos: "extension" (cada extensión en su carpeta: PDF, XLSX, etc.), "type" (categorías: Documentos, Imagenes, Videos, Audio, etc.), "date" (por mes: 2026-01, 2026-02), "custom" (con reglas personalizadas). Usa dry_run=true para previsualizar sin mover. IDEAL para organizar Descargas, Escritorio, etc. con cientos de archivos de una sola vez.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          path: { type: 'STRING' as const, description: 'Ruta del directorio a organizar (ej: C:\\Users\\fysg5\\Downloads).' },
          mode: { type: 'STRING' as const, description: 'Modo: "extension" (por extensión), "type" (por categoría inteligente), "date" (por mes), "custom" (reglas personalizadas). Default: "extension".' },
          rules: { type: 'OBJECT' as const, description: 'Solo para modo "custom". Mapa extensión→carpeta. Ej: {"pdf": "Reportes", "xlsx": "Excel", "*": "Otros"}.' },
          dry_run: { type: 'BOOLEAN' as const, description: 'Si es true, solo muestra qué haría sin mover nada. Útil para previsualizar.' },
        },
        required: ['path'],
      },
    },
    {
      name: 'batch_move_files',
      description: 'Mueve TODOS los archivos que coincidan con cierta extensión o patrón de un directorio a otro. Ideal para: "mueve todos los PDF de Descargas a Documentos", "pasa las fotos a la carpeta Imagenes".',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          source_directory: { type: 'STRING' as const, description: 'Directorio origen.' },
          destination_directory: { type: 'STRING' as const, description: 'Directorio destino (se crea si no existe).' },
          extensions: { type: 'ARRAY' as const, items: { type: 'STRING' as const }, description: 'Lista de extensiones a filtrar (ej: ["pdf", "docx"]). Sin punto.' },
          pattern: { type: 'STRING' as const, description: 'Patrón de nombre a filtrar (ej: "reporte", "factura"). Busca coincidencia parcial.' },
        },
        required: ['source_directory', 'destination_directory'],
      },
    },
    {
      name: 'list_directory_summary',
      description: 'Resume el contenido de un directorio: cuántos archivos hay por extensión, tamaño total, ejemplos de cada tipo. Ideal para directorios con muchos archivos (100+) donde list_directory sería demasiado largo. Usa esto PRIMERO para entender qué hay antes de organizar.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          path: { type: 'STRING' as const, description: 'Ruta del directorio.' },
        },
        required: ['path'],
      },
    },
    {
      name: 'get_system_info',
      description: 'Obtiene información del sistema: SO, CPU, RAM, disco, y las rutas del escritorio, documentos y descargas del usuario.',
      parameters: { type: 'OBJECT' as const, properties: {} },
    },
    {
      name: 'clipboard_read',
      description: 'Lee el portapapeles.',
      parameters: { type: 'OBJECT' as const, properties: {} },
    },
    {
      name: 'clipboard_write',
      description: 'Escribe texto en el portapapeles.',
      parameters: {
        type: 'OBJECT' as const,
        properties: { text: { type: 'STRING' as const, description: 'Texto a copiar.' } },
        required: ['text'],
      },
    },
    {
      name: 'whatsapp_send_file',
      description: 'Envía un archivo de la computadora al usuario directamente por WhatsApp. Usa esto cuando el usuario pida que le envíes un archivo.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          file_path: { type: 'STRING' as const, description: 'Ruta completa del archivo a enviar.' },
          caption: { type: 'STRING' as const, description: 'Texto que acompaña al archivo.' },
        },
        required: ['file_path'],
      },
    },
    // ─── Save received WhatsApp file to user-chosen location ──────
    {
      name: 'save_whatsapp_file',
      description: 'Copia un archivo recibido por WhatsApp (que fue guardado temporalmente) a una ubicación elegida por el usuario en su computadora. Usa esto cuando el usuario envía un archivo y quiere guardarlo en una carpeta específica.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          source_path: { type: 'STRING' as const, description: 'Ruta del archivo temporal (proporcionada en el contexto del mensaje recibido).' },
          destination_path: { type: 'STRING' as const, description: 'Ruta completa donde guardar el archivo (ej: C:/Users/user/Documents/archivo.pdf).' },
        },
        required: ['source_path', 'destination_path'],
      },
    },
    // ─── Open file on computer ─────────────────────────────────────
    {
      name: 'open_file_on_computer',
      description: 'Abre un archivo en la computadora del usuario con su aplicación predeterminada (ej: PDF con Acrobat, Excel con Excel, etc.). Usa esto cuando el usuario diga "abre", "ábreme", "muéstrame" un archivo.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          file_path: { type: 'STRING' as const, description: 'Ruta completa del archivo a abrir.' },
        },
        required: ['file_path'],
      },
    },
    // ─── Open URL in browser ─────────────────────────────────────
    {
      name: 'open_url',
      description: 'Abre una URL en el navegador predeterminado de la computadora del usuario. Úsalo para abrir Gmail compose, páginas web, etc. Para enviar emails usa: https://mail.google.com/mail/?view=cm&to=EMAIL&su=ASUNTO&body=CONTENIDO',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          url: { type: 'STRING' as const, description: 'URL completa a abrir en el navegador.' },
        },
        required: ['url'],
      },
    },
    // ─── Web tools ────────────────────────────────────────────────
    {
      name: 'web_search',
      description: 'Busca información en internet. Usa esto para responder preguntas sobre temas generales, noticias, datos actuales, etc.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          query: { type: 'STRING' as const, description: 'Texto de búsqueda.' },
        },
        required: ['query'],
      },
    },
    {
      name: 'read_webpage',
      description: 'Lee y extrae el texto de una página web dada una URL.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          url: { type: 'STRING' as const, description: 'URL completa de la página web.' },
        },
        required: ['url'],
      },
    },
    // ─── Smart file search ──────────────────────────────────────
    {
      name: 'smart_find_file',
      description: 'Busca un archivo por nombre en TODA la computadora del usuario (escritorio, documentos, descargas, OneDrive, subcarpetas). Usa esto SIEMPRE que el usuario mencione un archivo por nombre. No necesitas saber la ruta — esta herramienta busca automáticamente en todas las ubicaciones comunes.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          filename: { type: 'STRING' as const, description: 'Nombre del archivo a buscar (parcial o completo). Ej: "servicios", "tarea.pdf", "notas"' },
        },
        required: ['filename'],
      },
    },
    // ─── Screenshot tool ──────────────────────────────────────────
    {
      name: 'take_screenshot_and_send',
      description: 'Toma capturas de pantalla de TODOS los monitores de la computadora y las envía al usuario por WhatsApp. Si el usuario tiene múltiples monitores, se envía una imagen por cada uno.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          monitor_index: { type: 'NUMBER' as const, description: 'Índice del monitor específico (0, 1, 2...). Si se omite, captura TODOS los monitores.' },
        },
      },
    },
    // ─── Email tools ───────────────────────────────────────────────
    {
      name: 'get_email_config',
      description: 'Verifica si el email está configurado para enviar correos.',
      parameters: { type: 'OBJECT' as const, properties: {} },
    },
    {
      name: 'configure_email',
      description: 'Configura el email. Solo necesita email y contraseña de aplicación. El SMTP se detecta automáticamente.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          email: { type: 'STRING' as const, description: 'Email del usuario.' },
          password: { type: 'STRING' as const, description: 'Contraseña de aplicación.' },
        },
        required: ['email', 'password'],
      },
    },
    {
      name: 'send_email',
      description: 'Envía un email con texto y/o archivos adjuntos. Requiere confirmación del usuario.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          to: { type: 'STRING' as const, description: 'Email del destinatario.' },
          subject: { type: 'STRING' as const, description: 'Asunto.' },
          body: { type: 'STRING' as const, description: 'Cuerpo del email.' },
          attachment_paths: { type: 'ARRAY' as const, items: { type: 'STRING' as const }, description: 'Rutas de archivos a adjuntar.' },
          is_html: { type: 'BOOLEAN' as const, description: 'Si el body es HTML.' },
        },
        required: ['to', 'subject', 'body'],
      },
    },
    // ─── Memory tools ─────────────────────────────────────────────
    {
      name: 'save_lesson',
      description: 'Guarda una lección aprendida para no repetir el mismo error en el futuro. Úsalo cuando el usuario te corrija o cuando descubras algo importante (como una ruta correcta, una preferencia, etc.).',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          lesson: { type: 'STRING' as const, description: 'La lección o dato a recordar. Ej: "El escritorio del usuario está en C:\\Users\\fysg5\\OneDrive\\Escritorio"' },
          context: { type: 'STRING' as const, description: 'Contexto breve de por qué se aprendió esto.' },
        },
        required: ['lesson'],
      },
    },
    {
      name: 'recall_memories',
      description: 'Consulta todas las lecciones aprendidas previamente. Úsalo al inicio de tareas para recordar preferencias y errores pasados.',
      parameters: { type: 'OBJECT' as const, properties: {} },
    },
    // ─── Knowledge Base (OpenClaw-style .md files) ────────────────
    {
      name: 'knowledge_save',
      description: 'Guarda información importante en la base de conocimiento persistente (MEMORY.md). Usa esto para guardar datos duraderos: preferencias del usuario, decisiones, configuraciones, datos del sistema, etc. Esta información se inyecta SIEMPRE en cada conversación.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          content: { type: 'STRING' as const, description: 'El dato o conocimiento a guardar. Sé conciso y claro.' },
          section: { type: 'STRING' as const, description: 'Sección donde guardar. Opciones: "Preferencias Generales", "Lecciones Aprendidas", "Decisiones Arquitectónicas", "Datos del Sistema". También puedes crear secciones nuevas.' },
        },
        required: ['content'],
      },
    },
    {
      name: 'knowledge_update_user',
      description: 'Actualiza el perfil del usuario actual con información personal, preferencias o contexto laboral. Estos datos se inyectan automáticamente en cada conversación con este usuario.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          section: { type: 'STRING' as const, description: 'Sección del perfil: "Datos Personales", "Preferencias de Comunicación", "Contexto Laboral", "Notas Importantes".' },
          content: { type: 'STRING' as const, description: 'La información a guardar en esa sección del perfil.' },
        },
        required: ['section', 'content'],
      },
    },
    {
      name: 'knowledge_search',
      description: 'Busca información en toda la base de conocimiento (MEMORY.md, perfiles de usuario, logs diarios). Usa esto para recordar conversaciones pasadas, buscar datos guardados previamente.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          query: { type: 'STRING' as const, description: 'Texto a buscar en los archivos de conocimiento.' },
        },
        required: ['query'],
      },
    },
    {
      name: 'knowledge_log',
      description: 'Registra un evento o contexto en el log diario (memory/YYYY-MM-DD.md). Usa esto para eventos temporales, resúmenes de sesión, acciones realizadas. Los logs diarios NO se inyectan automáticamente — se consultan con knowledge_search.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          content: { type: 'STRING' as const, description: 'El evento o contexto a registrar.' },
        },
        required: ['content'],
      },
    },
    {
      name: 'knowledge_read',
      description: 'Lee el contenido de un archivo de conocimiento específico. Archivos disponibles: "MEMORY.md", "users/{phone}.md", "memory/YYYY-MM-DD.md".',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          file: { type: 'STRING' as const, description: 'Nombre del archivo a leer (ej: "MEMORY.md", "memory/2026-02-21.md").' },
        },
        required: ['file'],
      },
    },
    // ─── Computer Use ───────────────────────────────────────────
    {
      name: 'use_computer',
      description: 'Agente autónomo de escritorio V2: ve la pantalla en tiempo real con precisión mejorada (grid de coordenadas + Set-of-Marks + zoom de regiones). Hace clicks, doble-click, click derecho, ARRASTRA objetos, escribe texto, presiona teclas, gestiona ventanas. Se adapta proactivamente con planificación jerárquica (fases + sub-objetivos), verificación automática de acciones, y recuperación inteligente. Soporta tareas largas (200+ pasos) con resumen automático del historial. Reporta progreso en tiempo real.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          task: { type: 'STRING' as const, description: 'Descripción detallada de la tarea. Sé muy específico. Ej: "Escribe un correo en Gmail a juan@gmail.com con asunto Reporte, escribe el cuerpo, adjunta el archivo reporte.xlsx desde Documentos, y envíalo", "Instala la aplicación haciendo click en Next, Accept, Install", "Abre Minecraft, crea un mundo nuevo, y construye una casa de madera"' },
          max_steps: { type: 'NUMBER' as const, description: 'Máximo de pasos (defecto 200). Usa 300-500 para tareas muy complejas como juegos o workflows largos.' },
        },
        required: ['task'],
      },
    },
    // ─── System Control Tools ──────────────────────────────────────
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
    // ─── Full Power Tools ──────────────────────────────────────────
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
      description: 'Abre una aplicación o archivo con su programa predeterminado. REQUIERE confirmación.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          path: { type: 'STRING' as const, description: 'Ruta de la aplicación o archivo a abrir.' },
        },
        required: ['path'],
      },
    },
    {
      name: 'run_in_terminal',
      description: 'Abre una nueva ventana de terminal (PowerShell) VISIBLE y ejecuta un comando. La ventana queda abierta y el proceso sigue corriendo indefinidamente (sin timeout). Ideal para: npm run dev, servidores, builds largos, Claude Code, cualquier proceso de larga duración. REQUIERE confirmación.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          command: { type: 'STRING' as const, description: 'Comando a ejecutar en la terminal. Ej: "npm run dev", "git pull && npm install", "claude \\"corrige los errores\\"" ' },
          working_directory: { type: 'STRING' as const, description: 'Directorio de trabajo. Si no se especifica, usa el home del usuario.' },
          keep_open: { type: 'BOOLEAN' as const, description: 'Si es true (defecto), la terminal queda abierta después de que el comando termine. Si es false, se cierra al terminar.' },
        },
        required: ['command'],
      },
    },
    {
      name: 'run_claude_code',
      description: 'Lanza Claude Code (claude CLI) en una terminal visible con una tarea específica. Claude Code trabajará autónomamente en la tarea mientras el usuario no está. La terminal queda abierta para ver el progreso. REQUIERE confirmación.',
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
      name: 'whatsapp_send_to_contact',
      description: 'Envía un mensaje de texto y/o un archivo a OTRO número de WhatsApp (no al usuario actual). Útil para: enviar archivos a contactos, reenviar documentos, enviar mensajes a nombre del usuario. REQUIERE confirmación.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          phone_number: { type: 'STRING' as const, description: 'Número de teléfono del destinatario con código de país. Ej: "5215512345678" (México), "573001234567" (Colombia).' },
          message: { type: 'STRING' as const, description: 'Mensaje de texto a enviar. Opcional si se envía archivo.' },
          file_path: { type: 'STRING' as const, description: 'Ruta del archivo a enviar. Opcional si se envía solo texto.' },
          caption: { type: 'STRING' as const, description: 'Texto que acompaña al archivo. Solo aplica si se envía archivo.' },
        },
        required: ['phone_number'],
      },
    },
    {
      name: 'create_document',
      description: 'Crea un documento profesional. Para PRESENTACIONES usa type:"pptx" (se genera como PDF con diseño de slides premium). Proporciona slides_json con slides tipados y custom_theme con colores/fuentes generados según el contexto. SIEMPRE después de crear el documento, envíalo con whatsapp_send_file.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          type: { type: 'STRING' as const, description: '"word" para Word (.docx), "excel" para Excel (.xlsx), "pdf" para PDF (.pdf), "pptx" o "presentacion" para Presentación con slides (se genera como PDF con diseño premium), o "md" para Markdown (.md).' },
          filename: { type: 'STRING' as const, description: 'Nombre del archivo sin extensión.' },
          content: { type: 'STRING' as const, description: 'Para word/pdf/md: contenido en Markdown con ## para encabezados, **bold**, *italic*, listas, tablas. Para excel: JSON [{"Col1":"val"},...]. Para pptx: si no se proporciona slides_json, se parseará este contenido como Markdown (fallback).' },
          slides_json: { type: 'STRING' as const, description: 'SOLO para pptx. JSON array de SlideData con tipos variados. 15 TIPOS DISPONIBLES: title, content, two-column, image-focus, quote, section-break, comparison, closing, infographic, flowchart, data-table, stats, timeline, process, icon-grid. NUEVOS CAMPOS: items (para infographic/icon-grid): [{icon:"emoji",label:"...",description:"...",color:"hex"}], steps (para flowchart/timeline/process): [{label:"...",description:"..."}], tableData (para data-table): {headers:["..."],rows:[["..."]...]}, stats (para stats): [{value:"$1.2M",label:"Ventas",trend:"+15%"}]. Cada slide PUEDE incluir imagePrompt y/o diagramPrompt.' },
          custom_theme: { type: 'STRING' as const, description: 'SOLO para pptx. JSON con tema visual GENERADO DINÁMICAMENTE según el contexto. Estructura: {"colors":{"bg":"hex sin #","bgAlt":"hex","accent":"hex","accentAlt":"hex","text":"hex","textMuted":"hex","heading":"hex","scrim":"hex","scrimOpacity":55},"fontHeading":"nombre fuente","fontBody":"nombre fuente"}. Genera colores que reflejen el tema: naturaleza→verdes, tecnología→azules/neón, salud→turquesa, negocios→azul marino, etc. SIEMPRE genera este campo para pptx.' },
          include_images: { type: 'BOOLEAN' as const, description: 'Para pptx: si true, genera imágenes AI para cada diapositiva. Default: true.' },
          save_directory: { type: 'STRING' as const, description: 'Carpeta donde guardar. Si no se especifica, se guarda en el escritorio del usuario.' },
          title: { type: 'STRING' as const, description: 'Título principal del documento.' },
        },
        required: ['type', 'filename', 'content'],
      },
    },
    // ─── IRIS / Project Hub Tools ──────────────────────────────────
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
    // ─── IRIS Write Tools ─────────────────────────────────────────
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
    // ─── Google Calendar API (direct — no .ics files) ──────────────
    {
      name: 'google_calendar_create',
      description: 'Crea un evento DIRECTAMENTE en Google Calendar del usuario via API (sin archivos .ics). Requiere que el usuario haya conectado su Google Calendar en SofLIA Hub. Usa este en lugar de create_calendar_event cuando Google esté conectado.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          title: { type: 'STRING' as const, description: 'Título del evento.' },
          start_date: { type: 'STRING' as const, description: 'Fecha/hora de inicio en formato ISO: "2025-03-15T09:00:00"' },
          end_date: { type: 'STRING' as const, description: 'Fecha/hora de fin. Si no se especifica, dura 1 hora.' },
          description: { type: 'STRING' as const, description: 'Descripción del evento.' },
          location: { type: 'STRING' as const, description: 'Ubicación del evento.' },
        },
        required: ['title', 'start_date'],
      },
    },
    {
      name: 'google_calendar_get_events',
      description: 'Obtiene los eventos del Google Calendar del usuario. Útil para: "¿qué tengo hoy?", "¿qué tengo mañana?", "¿cuál es mi agenda?". Soporta buscar en un rango de fechas.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          start_date: { type: 'STRING' as const, description: 'Fecha de inicio a buscar en formato ISO 8601 (ej: "2026-02-21T00:00:00"). Si no se especifica, asume el inicio del día de hoy.' },
          end_date: { type: 'STRING' as const, description: 'Fecha de fin a buscar en formato ISO 8601. Si no se especifica, asume el final del día de la fecha de inicio.' },
        },
      },
    },
    {
      name: 'google_calendar_delete',
      description: 'Elimina un evento de Google Calendar por su ID. Primero usa google_calendar_get_events para obtener el ID.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          event_id: { type: 'STRING' as const, description: 'ID del evento a eliminar.' },
        },
        required: ['event_id'],
      },
    },
    // ─── Gmail API ─────────────────────────────────────────────────
    {
      name: 'gmail_send',
      description: 'Envía un email via Gmail API (no necesita configurar SMTP). Soporta adjuntar archivos locales. Requiere que el usuario haya conectado Google en SofLIA Hub. Usa este en lugar de send_email cuando Google esté conectado.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          to: { type: 'STRING' as const, description: 'Email(s) del destinatario, separados por coma.' },
          subject: { type: 'STRING' as const, description: 'Asunto del email.' },
          body: { type: 'STRING' as const, description: 'Cuerpo del email.' },
          cc: { type: 'STRING' as const, description: 'CC emails, separados por coma.' },
          is_html: { type: 'BOOLEAN' as const, description: 'Si el body es HTML.' },
          attachment_paths: { type: 'ARRAY' as const, items: { type: 'STRING' as const }, description: 'Rutas locales de archivos a adjuntar al email. Ejemplo: ["C:\\Users\\user\\Documents\\archivo.pdf"]' },
        },
        required: ['to', 'subject', 'body'],
      },
    },
    {
      name: 'gmail_get_messages',
      description: 'Lee los emails recientes del usuario via Gmail API. Puede filtrar por query (ej: "from:juan@gmail.com", "is:unread", "subject:factura").',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          query: { type: 'STRING' as const, description: 'Query de búsqueda Gmail (ej: "is:unread", "from:boss@company.com", "subject:reporte").' },
          max_results: { type: 'NUMBER' as const, description: 'Cantidad máxima de emails (1-50). Por defecto 20. Usa 50 para organización masiva.' },
        },
      },
    },
    {
      name: 'gmail_read_message',
      description: 'Lee el contenido completo de un email específico por su ID. Usa gmail_get_messages primero para obtener IDs.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          message_id: { type: 'STRING' as const, description: 'ID del mensaje a leer.' },
        },
        required: ['message_id'],
      },
    },
    {
      name: 'gmail_trash',
      description: 'Envía un email a la papelera de Gmail.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          message_id: { type: 'STRING' as const, description: 'ID del mensaje a eliminar.' },
        },
        required: ['message_id'],
      },
    },
    {
      name: 'gmail_get_labels',
      description: 'Lista todas las etiquetas/labels de Gmail del usuario (incluyendo las del sistema como INBOX, SPAM, etc. y las creadas por el usuario).',
      parameters: {
        type: 'OBJECT' as const,
        properties: {},
      },
    },
    {
      name: 'gmail_create_label',
      description: 'Crea una nueva etiqueta/label en Gmail. Si la etiqueta ya existe, devuelve la existente.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          name: { type: 'STRING' as const, description: 'Nombre de la etiqueta a crear (ej: "GitHub", "Open AI", "Trabajo").' },
        },
        required: ['name'],
      },
    },
    {
      name: 'gmail_modify_labels',
      description: 'Agrega o quita etiquetas de un email. Usa esto para organizar correos en etiquetas/carpetas. Para mover a una etiqueta: add_labels con el ID de la etiqueta. Para quitar de INBOX: remove_labels con "INBOX".',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          message_id: { type: 'STRING' as const, description: 'ID del mensaje a modificar.' },
          add_labels: { type: 'ARRAY' as const, items: { type: 'STRING' as const }, description: 'IDs de etiquetas a agregar al mensaje.' },
          remove_labels: { type: 'ARRAY' as const, items: { type: 'STRING' as const }, description: 'IDs de etiquetas a quitar del mensaje (ej: "INBOX" para sacarlo de la bandeja de entrada).' },
        },
        required: ['message_id'],
      },
    },
    {
      name: 'gmail_delete_label',
      description: 'Elimina una etiqueta/label de Gmail por su ID. Los correos que tenían esa etiqueta NO se eliminan, solo se les quita la etiqueta. Usa gmail_get_labels para obtener el ID primero.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          label_id: { type: 'STRING' as const, description: 'ID de la etiqueta a eliminar (ej: "Label_123456").' },
        },
        required: ['label_id'],
      },
    },
    {
      name: 'gmail_batch_empty_label',
      description: 'OPERACIÓN MASIVA: Mueve TODOS los correos de una etiqueta a la bandeja de entrada (INBOX) y opcionalmente elimina la etiqueta. Procesa TODOS los correos automáticamente (sin límite de 50). USA ESTA HERRAMIENTA en vez de gmail_modify_labels cuando necesites vaciar una etiqueta completa.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          label_id: { type: 'STRING' as const, description: 'ID de la etiqueta a vaciar (ej: "Label_10"). Usa gmail_get_labels para obtener IDs.' },
          delete_label: { type: 'BOOLEAN' as const, description: 'Si true, elimina la etiqueta después de vaciarla. Por defecto false.' },
        },
        required: ['label_id'],
      },
    },
    {
      name: 'gmail_empty_all_labels',
      description: 'OPERACIÓN NUCLEAR: Vacía TODAS las etiquetas del usuario (mueve todos los correos a INBOX) y ELIMINA todas las etiquetas. Una sola llamada procesa TODAS las etiquetas sin importar cuántas sean. Usa cuando el usuario pida "elimina todas las etiquetas", "saca todos los correos de las etiquetas", "borra todas las carpetas".',
      parameters: {
        type: 'OBJECT' as const,
        properties: {},
      },
    },
    // ─── Google Drive API ──────────────────────────────────────────
    {
      name: 'drive_list_files',
      description: 'Lista archivos del Google Drive del usuario. Puede filtrar por carpeta.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          folder_id: { type: 'STRING' as const, description: 'ID de carpeta para listar. Si no se especifica, lista la raíz.' },
          max_results: { type: 'NUMBER' as const, description: 'Máximo de archivos. Por defecto 20.' },
        },
      },
    },
    {
      name: 'drive_search',
      description: 'Busca archivos en Google Drive del usuario por nombre. Usa palabras clave CORTAS y relevantes (1-3 palabras clave). Ej: buscar "reunión marzo" en vez de "la transcripción de las notas de la reunión del 7 de marzo". Busca también en el contenido del documento.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          query: { type: 'STRING' as const, description: 'Texto a buscar en nombres de archivos de Drive.' },
        },
        required: ['query'],
      },
    },
    {
      name: 'drive_download',
      description: 'Descarga un archivo de Google Drive a la computadora del usuario. Google Docs/Sheets/Slides se exportan como TEXTO PLANO por defecto (para análisis directo). Usa format:"pdf" si necesitas enviar el archivo. La respuesta incluye textContent con el contenido del documento — NO necesitas read_file ni use_computer después. Para analizar: usa format:"text" (default). Para enviar: usa format:"pdf" + whatsapp_send_file.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          file_id: { type: 'STRING' as const, description: 'ID del archivo en Drive.' },
          file_name: { type: 'STRING' as const, description: 'Nombre para guardar el archivo localmente.' },
          format: { type: 'STRING' as const, description: '"text" (default) para exportar como texto plano (ideal para leer/analizar). "pdf" para exportar como PDF/XLSX (ideal para enviar por WhatsApp o email).' },
        },
        required: ['file_id', 'file_name'],
      },
    },
    {
      name: 'drive_upload',
      description: 'Sube un archivo de la computadora del usuario a Google Drive.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          file_path: { type: 'STRING' as const, description: 'Ruta local del archivo a subir.' },
          folder_id: { type: 'STRING' as const, description: 'ID de carpeta destino en Drive. Si no se especifica, se sube a la raíz.' },
          name: { type: 'STRING' as const, description: 'Nombre del archivo en Drive. Si no se especifica, usa el nombre local.' },
        },
        required: ['file_path'],
      },
    },
    {
      name: 'drive_create_folder',
      description: 'Crea una carpeta en Google Drive del usuario.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          name: { type: 'STRING' as const, description: 'Nombre de la carpeta.' },
          parent_id: { type: 'STRING' as const, description: 'ID de carpeta padre. Si no se especifica, se crea en la raíz.' },
        },
        required: ['name'],
      },
    },
    // ─── Google Chat API ──────────────────────────────────────────
    {
      name: 'gchat_list_spaces',
      description: 'Lista los espacios (chats, grupos, salas) de Google Chat del usuario.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {},
      },
    },
    {
      name: 'gchat_get_messages',
      description: 'Lee los mensajes recientes de un espacio de Google Chat. Usa gchat_list_spaces primero para obtener el nombre del espacio.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          space_name: { type: 'STRING' as const, description: 'Nombre del espacio (ej: "spaces/AAAAA"). Obtener con gchat_list_spaces.' },
          max_results: { type: 'NUMBER' as const, description: 'Cantidad máxima de mensajes. Por defecto 25.' },
        },
        required: ['space_name'],
      },
    },
    {
      name: 'gchat_send_message',
      description: 'Envía un mensaje de texto a un espacio de Google Chat. Puede responder en un hilo si se proporciona thread_name.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          space_name: { type: 'STRING' as const, description: 'Nombre del espacio destino (ej: "spaces/AAAAA").' },
          text: { type: 'STRING' as const, description: 'Texto del mensaje a enviar.' },
          thread_name: { type: 'STRING' as const, description: 'Nombre del hilo para responder (opcional). Si no se especifica, crea un nuevo mensaje.' },
        },
        required: ['space_name', 'text'],
      },
    },
    {
      name: 'gchat_add_reaction',
      description: 'Agrega una reacción emoji a un mensaje de Google Chat.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          message_name: { type: 'STRING' as const, description: 'Nombre completo del mensaje (ej: "spaces/AAAAA/messages/BBBBB").' },
          emoji: { type: 'STRING' as const, description: 'Emoji unicode para la reacción (ej: "👍", "❤️", "😂").' },
        },
        required: ['message_name', 'emoji'],
      },
    },
    {
      name: 'gchat_get_members',
      description: 'Lista los miembros de un espacio de Google Chat.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          space_name: { type: 'STRING' as const, description: 'Nombre del espacio (ej: "spaces/AAAAA").' },
        },
        required: ['space_name'],
      },
    },
    // ─── AutoDev tools ────────────────────────────────────────────
    {
      name: 'autodev_get_status',
      description: 'Obtiene el estado del sistema AutoDev (programación autónoma). Muestra si está habilitado, si hay un run en progreso, configuración actual, y conteo de runs del día.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {},
      },
    },
    {
      name: 'autodev_run_now',
      description: 'Ejecuta el sistema AutoDev inmediatamente. Analiza el código, investiga mejoras en la web, implementa cambios en una rama aislada, crea un PR en GitHub, y notifica el resultado.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {},
      },
    },
    {
      name: 'autodev_get_history',
      description: 'Obtiene el historial de ejecuciones de AutoDev. Muestra las últimas mejoras realizadas, PRs creados, investigación realizada, y resultados.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {},
      },
    },
    {
      name: 'autodev_update_config',
      description: 'Actualiza la configuración del sistema AutoDev.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          enabled: { type: 'BOOLEAN' as const, description: 'Habilitar/deshabilitar AutoDev.' },
          cron_schedule: { type: 'STRING' as const, description: 'Horario cron (ej: "0 3 * * *" para 3 AM diario).' },
          categories: { type: 'STRING' as const, description: 'Categorías separadas por coma: security,quality,performance,dependencies,tests' },
          notify_phone: { type: 'STRING' as const, description: 'Número de teléfono para notificaciones WhatsApp.' },
        },
      },
    },
    // ─── Clipboard AI Assistant ──────────────────────────────────────
    {
      name: 'search_clipboard_history',
      description: 'Busca inteligentemente en el historial reciente de textos copiados al portapapeles. Útil si el usuario pide "el link que copié", "la contraseña que copié hace rato", "el correo que estaba viendo".',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          query: { type: 'STRING' as const, description: 'Descripción en lenguaje natural de lo que se busca (ej: "el link de zoom", "la contraseña del wifi").' },
        },
        required: ['query'],
      },
    },
    // ─── Task Scheduler (recordatorios y tareas cron) ────────────────
    {
      name: 'task_scheduler',
      description: 'Programa una tarea, recordatorio o automatización para que tú (el agente) la ejecutes autónomamente en el futuro según una expresión Cron. Úsalo cuando el usuario pida "recuérdame hacer X a las 8am", "revisa el sistema cada hora", "envíame un resumen el viernes".',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          cron_expression: { type: 'STRING' as const, description: 'Expresión cron de 5 campos (ej: "0 8 * * *" = todos los días a las 8am, "0 9 * * 5" = viernes 9am).' },
          prompt: { type: 'STRING' as const, description: 'El requerimiento exacto que ejecutarás cuando se dispare (ej: "Genera el reporte de uso de CPU y envíalo").' },
        },
        required: ['cron_expression', 'prompt'],
      },
    },
    {
      name: 'list_scheduled_tasks',
      description: 'Lista todas las tareas y recordatorios programados actualmente para este usuario.',
      parameters: { type: 'OBJECT' as const, properties: {} },
    },
    {
      name: 'delete_scheduled_task',
      description: 'Elimina y cancela una tarea programada mediante su ID.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          task_id: { type: 'STRING' as const, description: 'El ID de la tarea a eliminar.' },
        },
        required: ['task_id'],
      },
    },
    // ─── Agent Task Queue (monitoreo de tareas en segundo plano) ─────
    {
      name: 'list_active_tasks',
      description: 'Lista todas las tareas en segundo plano activas del sistema, sus IDs, nombres y estado actual.',
      parameters: { type: 'OBJECT' as const, properties: {} },
    },
    {
      name: 'cancel_background_task',
      description: 'Cancela una tarea en segundo plano en ejecución usando su ID.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          taskId: { type: 'STRING' as const, description: 'El ID único de la tarea a cancelar.' },
        },
        required: ['taskId'],
      },
    },
    // ─── Smart Search (búsqueda semántica de archivos por contenido) ─
    {
      name: 'semantic_file_search',
      description: 'Busca archivos olvidados en la computadora por su CONTENIDO o descripción natural usando búsqueda semántica FTS5. Ideal para recuperar documentos cuando el usuario no recuerda el nombre (ej: "el reporte de ventas de marzo", "el contrato de arrendamiento").',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          query: { type: 'STRING' as const, description: 'Frase, palabras clave o tema a buscar dentro del contenido de los documentos.' },
          max_results: { type: 'NUMBER' as const, description: 'Máximo de resultados (por defecto 3).' },
        },
        required: ['query'],
      },
    },
    // ─── Neural Organizer (organización inteligente de descargas) ─────
    {
      name: 'neural_organizer_status',
      description: 'Obtiene el estado del Organizador Neuronal de archivos (si está vigilando la carpeta de descargas y cuántos ha procesado).',
      parameters: { type: 'OBJECT' as const, properties: {} },
    },
    {
      name: 'neural_organizer_toggle',
      description: 'Activa o desactiva el Organizador Neuronal que categoriza automáticamente los archivos descargados usando IA + OCR.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          enable: { type: 'BOOLEAN' as const, description: 'true para activar, false para desactivar.' },
        },
        required: ['enable'],
      },
    },

  ],
};
