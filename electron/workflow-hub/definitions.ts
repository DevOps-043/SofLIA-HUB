/**
 * Definiciones estáticas de los workflows soportados por el Hub.
 *
 * Cada `WorkflowDefinition` describe el contrato del workflow: qué capacidades
 * de Google necesita, qué campos puede configurar el usuario, qué motor lo
 * ejecuta (`automation`, `meeting`, `hybrid`) y su configuración por defecto.
 *
 * Para agregar un workflow nuevo:
 *  1. Agregar el id al type `WorkflowId` en `./types.ts`
 *  2. Agregar la definición a este array
 *  3. Si mapea a un template de WorkspaceAutomation, registrar el alias en
 *     `AUTOMATION_TEMPLATE_TO_WORKFLOW`
 */

import type { WorkflowDefinition, WorkflowId } from './types';

export const AUTOMATION_CASE_PREFIX = 'automation:';
export const MEETING_CASE_PREFIX = 'meeting:';

export const WORKFLOW_DEFINITIONS: WorkflowDefinition[] = [
  {
    id: 'correo',
    name: 'Correo',
    description: 'Triage ejecutivo de Gmail con aprobacion antes de actuar.',
    summary: 'Revisa correos prioritarios, propone etiquetas, respuesta o seguimiento.',
    engine: 'automation',
    triggerModes: ['activation', 'passive'],
    passiveBehavior: 'scheduled',
    configurableFields: ['preset de busqueda', 'maximo de resultados', 'salida opcional a Chat', 'archivar al terminar'],
    requiredCapabilities: ['gmail'],
    optionalCapabilities: ['gchat'],
    defaultConfig: { preset: 'unread', maxResults: 5, removeFromInbox: true, gchatSpace: '' },
  },
  {
    id: 'agenda',
    name: 'Agenda',
    description: 'Briefing diario del calendario con riesgos y puntos clave.',
    summary: 'Resume el dia y opcionalmente lo comparte por Google Chat.',
    engine: 'automation',
    triggerModes: ['activation', 'passive'],
    passiveBehavior: 'scheduled',
    configurableFields: ['fecha objetivo', 'salida opcional a Chat'],
    requiredCapabilities: ['calendar'],
    optionalCapabilities: ['gchat'],
    defaultConfig: { targetDate: '', gchatSpace: '' },
  },
  {
    id: 'seguimiento',
    name: 'Seguimiento',
    description: 'Borrador de correo de seguimiento listo para autorizacion.',
    summary: 'Redacta un seguimiento profesional con tono y firma configurables.',
    engine: 'automation',
    triggerModes: ['activation'],
    configurableFields: ['destinatario', 'tema', 'contexto base', 'tono', 'firma'],
    requiredCapabilities: ['gmail'],
    optionalCapabilities: [],
    defaultConfig: { to: '', topic: '', context: '', tone: 'profesional y claro', signature: '' },
  },
  {
    id: 'reuniones',
    name: 'Reuniones',
    description: 'Preparacion previa, procesamiento de notas/transcripciones y deteccion automatica.',
    summary: 'Unifica la preparacion, revision y sincronizacion de reuniones en un solo flujo.',
    engine: 'hybrid',
    triggerModes: ['activation', 'passive'],
    passiveBehavior: 'system',
    configurableFields: ['modo', 'fecha', 'equipo por defecto', 'proyecto por defecto', 'salida opcional a Chat'],
    requiredCapabilities: [],
    optionalCapabilities: ['calendar', 'drive', 'gmail', 'gchat', 'google_user_mapping'],
    defaultConfig: {
      mode: 'manual',
      targetDate: '',
      gchatSpace: '',
      meetingTitle: '',
      meetingType: 'general',
      defaultTeamId: '',
      defaultProjectId: '',
      manualText: '',
      driveRef: '',
    },
    modes: ['prep', 'manual', 'drive', 'auto'],
  },
  {
    id: 'drive',
    name: 'Drive',
    description: 'Crea espacios base de proyecto con plantillas de carpetas.',
    summary: 'Genera una estructura inicial y opcionalmente avisa al equipo.',
    engine: 'automation',
    triggerModes: ['activation'],
    configurableFields: ['nombre del proyecto', 'carpeta padre', 'plantilla de carpetas', 'salida opcional a Chat'],
    requiredCapabilities: ['drive'],
    optionalCapabilities: ['gchat'],
    defaultConfig: { projectName: '', parentFolderId: '', gchatSpace: '', folderPreset: 'cliente_estandar' },
  },
  {
    id: 'actualizacion_equipo',
    name: 'Actualizacion de equipo',
    description: 'Convierte contexto operativo en un mensaje ejecutivo para Google Chat.',
    summary: 'Redacta una actualizacion clara para un espacio de Chat.',
    engine: 'automation',
    triggerModes: ['activation'],
    configurableFields: ['destino', 'contexto', 'tono'],
    requiredCapabilities: ['gchat'],
    optionalCapabilities: [],
    defaultConfig: { spaceName: '', context: '', tone: 'ejecutivo y claro' },
  },
  {
    id: 'pc',
    name: 'PC',
    description: 'Prepara una accion operativa en la computadora con aprobacion obligatoria.',
    summary: 'Convierte un objetivo operativo en una tarea ejecutable por el agente de escritorio.',
    engine: 'automation',
    triggerModes: ['activation'],
    configurableFields: ['objetivo', 'backend preferido', 'URL inicial'],
    requiredCapabilities: [],
    optionalCapabilities: [],
    defaultConfig: { objective: '', backend: 'auto', startUrl: '' },
  },
];

/** Mapeo de template del WorkspaceAutomation → WorkflowId del Hub. */
export const AUTOMATION_TEMPLATE_TO_WORKFLOW: Record<string, WorkflowId> = {
  gmail_triage: 'correo',
  calendar_daily_brief: 'agenda',
  gmail_followup_draft: 'seguimiento',
  calendar_meeting_prep: 'reuniones',
  drive_project_workspace: 'drive',
  gchat_executive_update: 'actualizacion_equipo',
  desktop_action: 'pc',
};
