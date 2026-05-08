import type { GoogleToolDeclaration } from './types';
import { emptyParameters } from './types';

export const GMAIL_MESSAGE_TOOLS: GoogleToolDeclaration[] = [
  {
    name: 'gmail_send',
    description: 'Envia email via Gmail API. Soporta CC, HTML y adjuntos locales.',
    parameters: {
      type: 'OBJECT',
      properties: {
        to: { type: 'STRING', description: 'Destinatarios separados por coma.' },
        subject: { type: 'STRING', description: 'Asunto.' },
        body: { type: 'STRING', description: 'Cuerpo.' },
        cc: { type: 'STRING', description: 'CC separados por coma.' },
        is_html: { type: 'BOOLEAN', description: 'Indica si body es HTML.' },
        attachment_paths: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Rutas locales a adjuntar.' },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  {
    name: 'gmail_get_messages',
    description: 'Lee correos recientes con query, labels y paginacion.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Query Gmail, ej. is:unread o from:persona@empresa.com.' },
        max_results: { type: 'NUMBER', description: 'Maximo 1-50. Por defecto 20.' },
        label_ids: { type: 'ARRAY', items: { type: 'STRING' }, description: 'IDs de labels para filtrar.' },
        page_token: { type: 'STRING', description: 'Token next_page_token para continuar.' },
      },
    },
  },
  {
    name: 'gmail_read_message',
    description: 'Lee el contenido completo de un email por ID.',
    parameters: { type: 'OBJECT', properties: { message_id: { type: 'STRING', description: 'ID del mensaje.' } }, required: ['message_id'] },
  },
  {
    name: 'gmail_trash',
    description: 'Envia un email a la papelera de Gmail.',
    parameters: { type: 'OBJECT', properties: { message_id: { type: 'STRING', description: 'ID del mensaje.' } }, required: ['message_id'] },
  },
  {
    name: 'gmail_get_labels',
    description: 'Lista todas las etiquetas de Gmail del usuario.',
    parameters: emptyParameters(),
  },
  {
    name: 'gmail_create_label',
    description: 'Crea una etiqueta de Gmail o devuelve la existente.',
    parameters: { type: 'OBJECT', properties: { name: { type: 'STRING', description: 'Nombre de la etiqueta.' } }, required: ['name'] },
  },
];
