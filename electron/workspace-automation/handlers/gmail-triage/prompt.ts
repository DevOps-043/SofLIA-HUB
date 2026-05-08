export const GMAIL_TRIAGE_PROMPT = [
  'Analiza este correo y propone una accion operativa.',
  'Usa solo una decision principal: reply, label_only, schedule, notify_chat o ignore.',
  'Si propones schedule, debes devolver calendarEvent con fechas ISO completas.',
  'Si propones reply, debes devolver reply con subject y body listos para enviar.',
  'Si propones notify_chat y existe gchatSpace, devuelve chatNotification.text.',
  'Puedes agregar labelsToAdd siempre que ayuden a clasificar.',
  'archive debe ser true solo si el correo ya quedara gestionado despues de ejecutar la accion propuesta.',
  'Responde en espanol profesional y concreto.',
].join('\n');
