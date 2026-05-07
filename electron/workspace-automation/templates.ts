/**
 * Definiciones built-in de templates de workspace automation.
 *
 * Cada template describe un flujo de trabajo específico que el agente puede
 * ejecutar (ej. triage de Gmail, preparación de reunión). Los templates
 * `custom` se crean en runtime y se persisten junto con los runs.
 *
 * Para agregar un template nuevo:
 *  1. Agrega su definición a este array
 *  2. Crea su `LlmTaskSchema` en `./schemas.ts`
 *  3. Implementa el método `executeXxx` en `WorkspaceAutomationService`
 *  4. Registra el alias correspondiente en `workflow-hub/definitions.ts` si
 *     debe aparecer en el Workflow Hub
 */

import type { WorkflowTemplateDefinition } from './types';

export const TEMPLATE_DEFINITIONS: WorkflowTemplateDefinition[] = [
  {
    id: 'gmail_triage',
    name: 'Triage de Gmail',
    description:
      'Analiza el correo mas relevante, propone acciones y espera aprobacion antes de ejecutar.',
    kind: 'builtin',
    inputSchema: {
      query: 'string opcional',
      maxResults: 'number opcional',
      gchatSpace: 'string opcional',
      removeFromInbox: 'boolean opcional',
    },
  },
  {
    id: 'calendar_daily_brief',
    name: 'Briefing diario de calendario',
    description:
      'Resume los eventos del dia y puede publicar el briefing en Google Chat bajo aprobacion.',
    kind: 'builtin',
    inputSchema: {
      targetDate: 'YYYY-MM-DD opcional',
      gchatSpace: 'string opcional',
    },
  },
  {
    id: 'gmail_followup_draft',
    name: 'Correo de seguimiento',
    description:
      'Prepara un correo de seguimiento profesional y lo deja listo para enviar desde Gmail.',
    kind: 'builtin',
    inputSchema: {
      to: 'correo requerido',
      topic: 'string requerido',
      context: 'string opcional',
      tone: 'string opcional',
      signature: 'string opcional',
    },
  },
  {
    id: 'calendar_meeting_prep',
    name: 'Preparacion de reunion',
    description:
      'Resume la siguiente reunion del dia, sugiere talking points y puede compartir el prep en Google Chat.',
    kind: 'builtin',
    inputSchema: {
      targetDate: 'YYYY-MM-DD opcional',
      gchatSpace: 'string opcional',
    },
  },
  {
    id: 'drive_project_workspace',
    name: 'Espacio de proyecto en Drive',
    description:
      'Crea una estructura base de carpetas en Drive para organizar un proyecto o cliente.',
    kind: 'builtin',
    inputSchema: {
      projectName: 'string requerido',
      parentFolderId: 'string opcional',
      gchatSpace: 'string opcional',
      folders: 'array opcional',
    },
  },
  {
    id: 'gchat_executive_update',
    name: 'Actualizacion ejecutiva en Chat',
    description: 'Redacta y prepara un mensaje ejecutivo para Google Chat.',
    kind: 'builtin',
    inputSchema: {
      spaceName: 'string requerido',
      context: 'string requerido',
      tone: 'string opcional',
    },
  },
  {
    id: 'desktop_action',
    name: 'Accion en mi computadora',
    description:
      'Prepara una accion operativa dentro de la computadora para ejecutarla con autorizacion.',
    kind: 'builtin',
    inputSchema: {
      objective: 'string requerido',
    },
  },
];
