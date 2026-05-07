/**
 * Tools de comunicación: WhatsApp helpers, app chat interno, openers, web,
 * email SMTP y screenshot a WhatsApp.
 */

export const COMMUNICATION_TOOLS = [
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
  {
    name: 'app_chat_list_conversations',
    description: 'Lista las conversaciones internas de SofLIA Hub a las que el usuario tiene acceso dentro de la aplicacion.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        query: { type: 'STRING' as const, description: 'Filtro opcional por nombre de conversacion.' },
        limit: { type: 'NUMBER' as const, description: 'Cantidad maxima de resultados a devolver. Default: 20.' },
      },
    },
  },
  {
    name: 'app_chat_get_context',
    description: 'Lee mensajes recientes de una conversacion interna de SofLIA Hub para obtener contexto o resumen.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        conversation_ref: { type: 'STRING' as const, description: 'Nombre o ID de la conversacion.' },
        limit: { type: 'NUMBER' as const, description: 'Cantidad maxima de mensajes recientes a recuperar. Default: 12.' },
      },
      required: ['conversation_ref'],
    },
  },
  {
    name: 'app_chat_append_note',
    description: 'Agrega una nota o mensaje nuevo a una conversacion interna de SofLIA Hub.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        conversation_ref: { type: 'STRING' as const, description: 'Nombre o ID de la conversacion destino.' },
        content: { type: 'STRING' as const, description: 'Texto que se agregara a la conversacion.' },
      },
      required: ['conversation_ref', 'content'],
    },
  },
  {
    name: 'app_chat_list_assets',
    description: 'Lista archivos o assets asociados a una conversacion interna de SofLIA Hub.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        conversation_ref: { type: 'STRING' as const, description: 'Nombre o ID de la conversacion.' },
        query: { type: 'STRING' as const, description: 'Filtro opcional por nombre de archivo o referencia del asset.' },
        limit: { type: 'NUMBER' as const, description: 'Cantidad maxima de resultados a devolver. Default: 20.' },
      },
      required: ['conversation_ref'],
    },
  },
  {
    name: 'app_chat_send_asset',
    description: 'Recupera un archivo de una conversacion interna de SofLIA Hub y lo envia al usuario por WhatsApp.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        conversation_ref: { type: 'STRING' as const, description: 'Nombre o ID de la conversacion origen.' },
        asset_ref: { type: 'STRING' as const, description: 'Nombre del archivo o referencia del asset dentro de la conversacion.' },
        caption: { type: 'STRING' as const, description: 'Texto opcional para acompanar el archivo enviado.' },
      },
      required: ['conversation_ref', 'asset_ref'],
    },
  },
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
];
