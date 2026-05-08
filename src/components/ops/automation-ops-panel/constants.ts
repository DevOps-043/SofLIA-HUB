import type { ActiveAutomationAction, TriagePresetId } from './types';

export const TRIAGE_PRESETS: Array<{
  id: TriagePresetId;
  label: string;
  description: string;
  query: string;
}> = [
  { id: 'today', label: 'Correos nuevos de hoy', description: 'Ideal para revisar lo mas reciente sin configurar nada.', query: 'in:inbox newer_than:1d' },
  { id: 'unread', label: 'Correos pendientes de responder', description: 'Busca mensajes no leidos de los ultimos dias.', query: 'in:inbox is:unread newer_than:7d' },
  { id: 'priority', label: 'Correos importantes', description: 'Prioriza conversaciones de la bandeja principal.', query: 'in:inbox category:primary newer_than:7d' },
  { id: 'custom', label: 'Filtro avanzado', description: 'Para quien ya conoce filtros de Gmail.', query: 'in:inbox newer_than:7d' },
];

export const ACTION_TABS: Array<{ id: ActiveAutomationAction; label: string }> = [
  { id: 'triage', label: 'Correos' },
  { id: 'brief', label: 'Agenda' },
  { id: 'followup', label: 'Seguimiento' },
  { id: 'meeting', label: 'Reunion' },
  { id: 'drive', label: 'Drive' },
  { id: 'chat', label: 'Chat' },
  { id: 'desktop', label: 'PC' },
  { id: 'custom', label: 'Flujos' },
];

export const RUN_STATUS_LABELS: Record<string, string> = {
  needs_approval: 'Por autorizar',
  completed: 'Completado',
  failed: 'Con error',
  rejected: 'No autorizado',
  cancelled: 'Cancelado',
};

export const ACTION_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  executed: 'Ejecutada',
  failed: 'Con error',
  skipped: 'Omitida',
};

export const TEMPLATE_LABELS: Record<string, string> = {
  gmail_triage: 'Revision de correo',
  calendar_daily_brief: 'Resumen de agenda',
  gmail_followup_draft: 'Correo de seguimiento',
  calendar_meeting_prep: 'Preparacion de reunion',
  drive_project_workspace: 'Espacio de proyecto en Drive',
  gchat_executive_update: 'Actualizacion ejecutiva en Chat',
  desktop_action: 'Accion en mi computadora',
};

export const ACTION_KIND_LABELS: Record<string, string> = {
  gmail_labels: 'Etiquetas en Gmail',
  gmail_reply: 'Respuesta por Gmail',
  gmail_send: 'Correo nuevo por Gmail',
  calendar_event: 'Evento de calendario',
  gchat_message: 'Mensaje en Google Chat',
  drive_folder_tree: 'Estructura en Google Drive',
  desktop_task: 'Accion en la computadora',
};

export const FIELD_LABELS: Record<string, string> = {
  summary: 'Resumen',
  rationale: 'Motivo',
  confidence: 'Confianza',
  keyPoints: 'Puntos clave',
  risks: 'Riesgos',
  talkingPoints: 'Puntos sugeridos',
  chatDraft: 'Mensaje sugerido',
  decision: 'Decision',
  labelsToAdd: 'Etiquetas',
  archive: 'Archivar',
  messageId: 'Correo',
  addLabels: 'Etiquetas nuevas',
  removeLabels: 'Etiquetas a quitar',
  to: 'Para',
  subject: 'Asunto',
  body: 'Mensaje',
  spaceName: 'Google Chat',
  text: 'Texto',
  message: 'Mensaje',
  title: 'Titulo',
  start: 'Inicio',
  end: 'Fin',
  description: 'Descripcion',
  location: 'Ubicacion',
  task: 'Tarea',
  projectName: 'Proyecto',
  folders: 'Carpetas',
  parentFolderId: 'Carpeta padre',
  topic: 'Tema',
  objective: 'Objetivo',
  steps: 'Pasos',
  missingData: 'Datos faltantes',
  guidance: 'Guia',
};
