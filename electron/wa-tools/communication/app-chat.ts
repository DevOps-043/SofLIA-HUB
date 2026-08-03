export const APP_CHAT_TOOLS = [
  {
    name: 'app_chat_list_conversations',
    description: 'Lista las conversaciones internas de Pulse Hub a las que el usuario tiene acceso dentro de la aplicacion.',
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
    description: 'Lee mensajes recientes de una conversacion interna de Pulse Hub para obtener contexto o resumen.',
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
    description: 'Agrega una nota o mensaje nuevo a una conversacion interna de Pulse Hub.',
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
    description: 'Lista archivos o assets asociados a una conversacion interna de Pulse Hub.',
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
    description: 'Recupera un archivo de una conversacion interna de Pulse Hub y lo envia al usuario por WhatsApp.',
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
];
