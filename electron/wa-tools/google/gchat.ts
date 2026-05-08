import type { GoogleToolDeclaration } from './types';
import { emptyParameters } from './types';

export const GCHAT_TOOLS: GoogleToolDeclaration[] = [
  {
    name: 'gchat_list_spaces',
    description: 'Lista espacios de Google Chat del usuario.',
    parameters: emptyParameters(),
  },
  {
    name: 'gchat_get_messages',
    description: 'Lee mensajes recientes de un chat o espacio.',
    parameters: {
      type: 'OBJECT',
      properties: {
        space_name: { type: 'STRING', description: 'spaces/..., correo, users/... o URL del chat.' },
        max_results: { type: 'NUMBER', description: 'Cantidad maxima. Default 25.' },
      },
      required: ['space_name'],
    },
  },
  {
    name: 'gchat_send_message',
    description: 'Envia mensaje a un chat o espacio y puede responder en hilo.',
    parameters: {
      type: 'OBJECT',
      properties: {
        space_name: { type: 'STRING', description: 'Destino: spaces/..., correo, users/... o URL.' },
        text: { type: 'STRING', description: 'Texto a enviar.' },
        thread_name: { type: 'STRING', description: 'Hilo opcional.' },
      },
      required: ['space_name', 'text'],
    },
  },
  {
    name: 'gchat_add_reaction',
    description: 'Agrega una reaccion emoji a un mensaje de Google Chat.',
    parameters: {
      type: 'OBJECT',
      properties: {
        message_name: { type: 'STRING', description: 'Nombre completo del mensaje.' },
        emoji: { type: 'STRING', description: 'Emoji unicode.' },
      },
      required: ['message_name', 'emoji'],
    },
  },
  {
    name: 'gchat_get_members',
    description: 'Lista miembros de un chat o espacio.',
    parameters: {
      type: 'OBJECT',
      properties: { space_name: { type: 'STRING', description: 'spaces/..., correo, users/... o URL.' } },
      required: ['space_name'],
    },
  },
];
