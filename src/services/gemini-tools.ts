/**
 * Gemini Function Calling tool definitions for Computer Use.
 * These declarations tell Gemini what tools are available.
 */

export const COMPUTER_USE_TOOLS = {
  functionDeclarations: [
    {
      name: 'list_directory',
      description: 'Lista todos los archivos y carpetas en un directorio del sistema del usuario. Devuelve nombre, tamaño, tipo y fechas de cada elemento.',
      parameters: {
        type: 'OBJECT',
        properties: {
          path: {
            type: 'STRING',
            description: 'Ruta del directorio a listar. Usa la ruta del escritorio del usuario si no se especifica (ej: C:\\Users\\usuario\\Desktop).',
          },
          show_hidden: {
            type: 'BOOLEAN',
            description: 'Si es true, muestra archivos ocultos. Por defecto false.',
          },
        },
        required: ['path'],
      },
    },
    {
      name: 'read_file',
      description: 'Lee y devuelve el contenido de un archivo de texto del sistema. Máximo 1MB.',
      parameters: {
        type: 'OBJECT',
        properties: {
          path: {
            type: 'STRING',
            description: 'Ruta completa del archivo a leer.',
          },
        },
        required: ['path'],
      },
    },
    {
      name: 'write_file',
      description: 'Crea o sobrescribe un archivo con el contenido especificado. Crea las carpetas padre automáticamente si no existen.',
      parameters: {
        type: 'OBJECT',
        properties: {
          path: {
            type: 'STRING',
            description: 'Ruta completa donde crear/escribir el archivo.',
          },
          content: {
            type: 'STRING',
            description: 'Contenido de texto a escribir en el archivo.',
          },
        },
        required: ['path', 'content'],
      },
    },
    {
      name: 'create_directory',
      description: 'Crea una carpeta nueva (y todas las carpetas padre necesarias).',
      parameters: {
        type: 'OBJECT',
        properties: {
          path: {
            type: 'STRING',
            description: 'Ruta completa de la carpeta a crear.',
          },
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
          source_path: {
            type: 'STRING',
            description: 'Ruta actual del archivo o carpeta.',
          },
          destination_path: {
            type: 'STRING',
            description: 'Nueva ruta de destino.',
          },
        },
        required: ['source_path', 'destination_path'],
      },
    },
    {
      name: 'copy_item',
      description: 'Copia un archivo o carpeta (incluyendo contenido recursivo) a otra ubicación.',
      parameters: {
        type: 'OBJECT',
        properties: {
          source_path: {
            type: 'STRING',
            description: 'Ruta del archivo o carpeta a copiar.',
          },
          destination_path: {
            type: 'STRING',
            description: 'Ruta de destino para la copia.',
          },
        },
        required: ['source_path', 'destination_path'],
      },
    },
    {
      name: 'delete_item',
      description: 'Envía un archivo o carpeta a la papelera de reciclaje (no elimina permanentemente). Requiere confirmación del usuario.',
      parameters: {
        type: 'OBJECT',
        properties: {
          path: {
            type: 'STRING',
            description: 'Ruta del archivo o carpeta a enviar a la papelera.',
          },
        },
        required: ['path'],
      },
    },
    {
      name: 'get_file_info',
      description: 'Obtiene información detallada sobre un archivo o carpeta: tamaño, fechas de creación/modificación, extensión.',
      parameters: {
        type: 'OBJECT',
        properties: {
          path: {
            type: 'STRING',
            description: 'Ruta del archivo o carpeta.',
          },
        },
        required: ['path'],
      },
    },
    {
      name: 'search_files',
      description: 'Busca archivos y carpetas por nombre dentro de un directorio (recursivo hasta 5 niveles).',
      parameters: {
        type: 'OBJECT',
        properties: {
          directory: {
            type: 'STRING',
            description: 'Directorio donde buscar.',
          },
          pattern: {
            type: 'STRING',
            description: 'Patrón de texto a buscar en los nombres de archivo (case-insensitive).',
          },
        },
        required: ['pattern'],
      },
    },
    {
      name: 'execute_command',
      description: 'Ejecuta un comando en la terminal del sistema (PowerShell en Windows). Requiere confirmación del usuario. Timeout de 30 segundos. Usa esto para instalar programas, ejecutar scripts, ver procesos, etc.',
      parameters: {
        type: 'OBJECT',
        properties: {
          command: {
            type: 'STRING',
            description: 'Comando a ejecutar en la terminal.',
          },
        },
        required: ['command'],
      },
    },
    {
      name: 'open_application',
      description: 'Abre un archivo o aplicación con el programa predeterminado del sistema.',
      parameters: {
        type: 'OBJECT',
        properties: {
          path: {
            type: 'STRING',
            description: 'Ruta del archivo o aplicación a abrir.',
          },
        },
        required: ['path'],
      },
    },
    {
      name: 'open_url',
      description: 'Abre una URL en el navegador web predeterminado del usuario.',
      parameters: {
        type: 'OBJECT',
        properties: {
          url: {
            type: 'STRING',
            description: 'URL completa a abrir (incluyendo https://).',
          },
        },
        required: ['url'],
      },
    },
    {
      name: 'get_system_info',
      description: 'Obtiene información del sistema: SO, CPU, RAM, disco, nombre de usuario, directorio home.',
      parameters: {
        type: 'OBJECT',
        properties: {},
      },
    },
    {
      name: 'clipboard_read',
      description: 'Lee el contenido actual del portapapeles del usuario.',
      parameters: {
        type: 'OBJECT',
        properties: {},
      },
    },
    {
      name: 'clipboard_write',
      description: 'Escribe texto en el portapapeles del usuario.',
      parameters: {
        type: 'OBJECT',
        properties: {
          text: {
            type: 'STRING',
            description: 'Texto a copiar al portapapeles.',
          },
        },
        required: ['text'],
      },
    },
    {
      name: 'take_screenshot',
      description: 'Captura una imagen de la pantalla actual del usuario.',
      parameters: {
        type: 'OBJECT',
        properties: {},
      },
    },
    // ─── Email Tools ────────────────────────────────────────────
    {
      name: 'get_email_config',
      description: 'Verifica si el email está configurado. Úsalo antes de enviar un email para comprobar que hay credenciales SMTP configuradas.',
      parameters: {
        type: 'OBJECT',
        properties: {},
      },
    },
    {
      name: 'configure_email',
      description: 'Configura el email para enviar correos. Solo necesita el email y la contraseña de aplicación del usuario. El servidor SMTP se detecta automáticamente (Gmail, Outlook, Yahoo, iCloud, etc). Solo necesita hacerse UNA VEZ, después el email queda configurado permanentemente.',
      parameters: {
        type: 'OBJECT',
        properties: {
          email: {
            type: 'STRING',
            description: 'Dirección de email del usuario (ej: nombre@gmail.com).',
          },
          password: {
            type: 'STRING',
            description: 'Contraseña de aplicación (para Gmail: se genera en myaccount.google.com > Seguridad > Contraseñas de aplicaciones).',
          },
        },
        required: ['email', 'password'],
      },
    },
    {
      name: 'send_email',
      description: 'Envía un email con texto y/o archivos adjuntos. Requiere que el email esté configurado (usa get_email_config para verificar). Puede adjuntar archivos del sistema de archivos local. Requiere confirmación del usuario.',
      parameters: {
        type: 'OBJECT',
        properties: {
          to: {
            type: 'STRING',
            description: 'Dirección de email del destinatario.',
          },
          subject: {
            type: 'STRING',
            description: 'Asunto del email.',
          },
          body: {
            type: 'STRING',
            description: 'Cuerpo del email (texto plano o HTML según is_html).',
          },
          attachment_paths: {
            type: 'ARRAY',
            items: { type: 'STRING' },
            description: 'Lista de rutas completas de archivos a adjuntar. Opcional.',
          },
          is_html: {
            type: 'BOOLEAN',
            description: 'Si es true, el body se trata como HTML. Por defecto false (texto plano).',
          },
        },
        required: ['to', 'subject', 'body'],
      },
    },
  ],
};

/**
 * WhatsApp-specific tool: send a file from the computer to the user via WhatsApp.
 * This is only used by the main-process WhatsApp agent, not by the renderer.
 */
export const WHATSAPP_SEND_FILE_TOOL = {
  name: 'whatsapp_send_file',
  description: 'Envía un archivo de la computadora al usuario directamente por WhatsApp.',
  parameters: {
    type: 'OBJECT',
    properties: {
      file_path: {
        type: 'STRING',
        description: 'Ruta completa del archivo a enviar por WhatsApp.',
      },
      caption: {
        type: 'STRING',
        description: 'Texto opcional que acompaña al archivo.',
      },
    },
    required: ['file_path'],
  },
};

/** Names of all computer-use tools, for quick lookup */
export const COMPUTER_TOOL_NAMES = new Set(
  COMPUTER_USE_TOOLS.functionDeclarations.map(t => t.name)
);
