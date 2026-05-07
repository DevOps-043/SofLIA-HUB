/**
 * Tools de automatización: scheduler cron + tareas activas + neural organizer.
 */

export const AUTOMATION_TOOLS = [
  {
    name: 'task_scheduler',
    description: 'Programa una tarea, recordatorio o automatización para que tú (el agente) la ejecutes autónomamente en el futuro según una expresión Cron. Úsalo cuando el usuario pida "recuérdame hacer X a las 8am", "revisa el sistema cada hora", "envíame un resumen el viernes".',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        cron_expression: { type: 'STRING' as const, description: 'Expresión cron de 5 campos (ej: "0 8 * * *" = todos los días a las 8am, "0 9 * * 5" = viernes 9am).' },
        prompt: { type: 'STRING' as const, description: 'El requerimiento exacto que ejecutarás cuando se dispare (ej: "Genera el reporte de uso de CPU y envíalo").' },
      },
      required: ['cron_expression', 'prompt'],
    },
  },
  {
    name: 'list_scheduled_tasks',
    description: 'Lista todas las tareas y recordatorios programados actualmente para este usuario.',
    parameters: { type: 'OBJECT' as const, properties: {} },
  },
  {
    name: 'delete_scheduled_task',
    description: 'Elimina y cancela una tarea programada mediante su ID.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        task_id: { type: 'STRING' as const, description: 'El ID de la tarea a eliminar.' },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'list_active_tasks',
    description: 'Lista todas las tareas en segundo plano activas del sistema, sus IDs, nombres y estado actual.',
    parameters: { type: 'OBJECT' as const, properties: {} },
  },
  {
    name: 'cancel_background_task',
    description: 'Cancela una tarea en segundo plano en ejecución usando su ID.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        taskId: { type: 'STRING' as const, description: 'El ID único de la tarea a cancelar.' },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'neural_organizer_status',
    description: 'Obtiene el estado del Organizador Neuronal de archivos (si está vigilando la carpeta de descargas y cuántos ha procesado).',
    parameters: { type: 'OBJECT' as const, properties: {} },
  },
  {
    name: 'neural_organizer_toggle',
    description: 'Activa o desactiva el Organizador Neuronal que categoriza automáticamente los archivos descargados usando IA + OCR.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        enable: { type: 'BOOLEAN' as const, description: 'true para activar, false para desactivar.' },
      },
      required: ['enable'],
    },
  },
];
