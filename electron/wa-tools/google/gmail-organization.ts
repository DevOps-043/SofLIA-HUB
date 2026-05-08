import type { GoogleToolDeclaration } from './types';
import { emptyParameters } from './types';

export const GMAIL_ORGANIZATION_TOOLS: GoogleToolDeclaration[] = [
  {
    name: 'gmail_preview_organization',
    description: 'Analiza inbox y genera un plan de organizacion sin modificar correos.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Filtro Gmail opcional. Default in:inbox.' },
        max_messages: { type: 'NUMBER', description: 'Maximo de correos a analizar.' },
        min_group_size: { type: 'NUMBER', description: 'Minimo de correos por grupo propuesto.' },
        remove_from_inbox: { type: 'BOOLEAN', description: 'Propone quitar correos del inbox al aplicar.' },
        page_limit: { type: 'NUMBER', description: 'Maximo de paginas a recorrer.' },
      },
    },
  },
  {
    name: 'gmail_apply_organization_plan',
    description: 'Aplica un plan de organizacion generado por gmail_preview_organization.',
    parameters: {
      type: 'OBJECT',
      properties: {
        plan_id: { type: 'STRING', description: 'ID del plan.' },
        remove_from_inbox: { type: 'BOOLEAN', description: 'Sobrescribe si se quita del inbox.' },
      },
      required: ['plan_id'],
    },
  },
  {
    name: 'gmail_undo_organization_plan',
    description: 'Revierte un plan aplicado. Sin plan_id usa el ultimo.',
    parameters: { type: 'OBJECT', properties: { plan_id: { type: 'STRING', description: 'ID opcional del plan aplicado.' } } },
  },
  {
    name: 'gmail_modify_labels',
    description: 'Agrega o quita etiquetas de un email.',
    parameters: {
      type: 'OBJECT',
      properties: {
        message_id: { type: 'STRING', description: 'ID del mensaje.' },
        add_labels: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Labels a agregar.' },
        remove_labels: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Labels a quitar, ej. INBOX.' },
      },
      required: ['message_id'],
    },
  },
  {
    name: 'gmail_delete_label',
    description: 'Elimina una etiqueta por ID sin borrar correos.',
    parameters: { type: 'OBJECT', properties: { label_id: { type: 'STRING', description: 'ID de etiqueta.' } }, required: ['label_id'] },
  },
  {
    name: 'gmail_batch_empty_label',
    description: 'Mueve todos los correos de una etiqueta a INBOX y opcionalmente elimina la etiqueta.',
    parameters: {
      type: 'OBJECT',
      properties: {
        label_id: { type: 'STRING', description: 'ID de etiqueta.' },
        delete_label: { type: 'BOOLEAN', description: 'Eliminar etiqueta despues de vaciarla.' },
      },
      required: ['label_id'],
    },
  },
  {
    name: 'gmail_empty_all_labels',
    description: 'Vacia y elimina todas las etiquetas del usuario.',
    parameters: emptyParameters(),
  },
];
