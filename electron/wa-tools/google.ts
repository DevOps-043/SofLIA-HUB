/**
 * Tools de Google Workspace: Calendar + Gmail + Drive + Chat.
 *
 * Todas requieren que el usuario haya conectado Google en SofLIA Hub.
 * Las operaciones destructivas (delete, send, organize) están en CONFIRM_TOOLS_WA.
 */

export const GOOGLE_TOOLS = [
  // ─── Google Calendar ──────────────────────────────────────────
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
  // ─── Gmail ─────────────────────────────────────────────────────
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
    description: 'Lee los emails recientes del usuario via Gmail API. Puede filtrar por query (ej: "from:juan@gmail.com", "is:unread", "subject:factura"), por label_ids y continuar leyendo más lotes con page_token. La respuesta puede incluir next_page_token y likely_has_more.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        query: { type: 'STRING' as const, description: 'Query de búsqueda Gmail (ej: "is:unread", "from:boss@company.com", "subject:reporte").' },
        max_results: { type: 'NUMBER' as const, description: 'Cantidad máxima de emails (1-50). Por defecto 20. Usa 50 para organización masiva.' },
        label_ids: { type: 'ARRAY' as const, items: { type: 'STRING' as const }, description: 'Opcional. IDs de etiquetas para filtrar correos dentro de labels específicas.' },
        page_token: { type: 'STRING' as const, description: 'Opcional. Token devuelto por una llamada anterior en next_page_token para continuar con el siguiente lote.' },
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
    parameters: { type: 'OBJECT' as const, properties: {} },
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
    name: 'gmail_preview_organization',
    description: 'Analiza el inbox de Gmail y genera un plan de organización por empresa o remitente sin modificar correos todavía. Devuelve un plan_id para aplicarlo después.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        query: { type: 'STRING' as const, description: 'Filtro opcional de Gmail. Si no se especifica, usa in:inbox.' },
        max_messages: { type: 'NUMBER' as const, description: 'Máximo de correos a analizar en el preview.' },
        min_group_size: { type: 'NUMBER' as const, description: 'Tamaño mínimo de grupo para proponer una etiqueta.' },
        remove_from_inbox: { type: 'BOOLEAN' as const, description: 'Si es true, el plan propondrá quitar los correos del inbox al aplicarse.' },
        page_limit: { type: 'NUMBER' as const, description: 'Número máximo de páginas a recorrer para el análisis.' },
      },
    },
  },
  {
    name: 'gmail_apply_organization_plan',
    description: 'Aplica un plan de organización generado previamente por gmail_preview_organization.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        plan_id: { type: 'STRING' as const, description: 'ID del plan generado en el preview.' },
        remove_from_inbox: { type: 'BOOLEAN' as const, description: 'Opcional. Sobrescribe si al aplicar se quitan los correos del inbox.' },
      },
      required: ['plan_id'],
    },
  },
  {
    name: 'gmail_undo_organization_plan',
    description: 'Revierte un plan de organización de Gmail previamente aplicado. Si no se pasa plan_id, intenta revertir el último plan aplicado.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        plan_id: { type: 'STRING' as const, description: 'Opcional. ID del plan aplicado que se desea revertir. Si se omite, usa el último plan aplicado.' },
      },
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
    parameters: { type: 'OBJECT' as const, properties: {} },
  },
  // ─── Google Drive ──────────────────────────────────────────────
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
  // ─── Google Chat ───────────────────────────────────────────────
  {
    name: 'gchat_list_spaces',
    description: 'Lista los espacios (chats, grupos, salas) de Google Chat del usuario.',
    parameters: { type: 'OBJECT' as const, properties: {} },
  },
  {
    name: 'gchat_get_messages',
    description: 'Lee los mensajes recientes de un chat o espacio de Google Chat. Acepta un resource name tipo "spaces/AAAAA", el correo del contacto para resolver un chat directo, un alias "users/alguien@empresa.com", o una URL del chat directo.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        space_name: { type: 'STRING' as const, description: 'Referencia del chat: "spaces/AAAAA", correo del contacto, alias "users/alguien@empresa.com" o URL del chat.' },
        max_results: { type: 'NUMBER' as const, description: 'Cantidad máxima de mensajes. Por defecto 25.' },
      },
      required: ['space_name'],
    },
  },
  {
    name: 'gchat_send_message',
    description: 'Envía un mensaje de texto a un chat o espacio de Google Chat. Acepta "spaces/AAAAA", correo del contacto, alias "users/alguien@empresa.com" o URL del chat. Puede responder en un hilo si se proporciona thread_name.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        space_name: { type: 'STRING' as const, description: 'Referencia del chat destino: "spaces/AAAAA", correo, alias users/... o URL del chat.' },
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
    description: 'Lista los miembros de un chat o espacio de Google Chat. Acepta "spaces/AAAAA", correo del contacto, alias users/... o URL del chat.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        space_name: { type: 'STRING' as const, description: 'Referencia del espacio: "spaces/AAAAA", correo, alias users/... o URL del chat.' },
      },
      required: ['space_name'],
    },
  },
];
