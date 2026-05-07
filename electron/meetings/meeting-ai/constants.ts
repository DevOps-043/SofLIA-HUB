/**
 * Constantes del pipeline de extracción AI de reuniones.
 *
 * Centralizadas para que ajustes de modelo, umbrales o vocabularios
 * permitidos no requieran tocar la clase principal.
 */

/** Modelo Gemini usado para clasificación + extracción. */
export const EXTRACTION_MODEL = 'gemini-2.5-flash';

/** Tope de caracteres del texto fuente que se envía al modelo. */
export const MAX_SOURCE_TEXT_CHARS = 16000;

/**
 * Umbral por debajo del cual una tarea se marca como "estado de baja
 * confianza" — el LLM no está seguro de su asignación o estado real.
 */
export const LOW_CONFIDENCE_TASK_STATE_THRESHOLD = 0.65;

/** Destinos válidos para routing de items extraídos. */
export const ALLOWED_DESTINATIONS = ['IRIS', 'Project Hub', 'Team', 'Project', 'None'] as const;

/** Tipos válidos de follow-up generables por el modelo. */
export const ALLOWED_FOLLOW_UP_TYPES = [
  'meeting',
  'message',
  'validation',
  'reminder',
  'escalation',
] as const;

/** Prioridades válidas para tareas/issues extraídos. */
export const ALLOWED_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;

/**
 * Acciones que el agente NUNCA debe ejecutar automáticamente sin aprobación
 * humana, incluso si el LLM las sugiere con alta confianza.
 */
export const DEFAULT_BLOCKED_ACTIONS = [
  'mensajes externos automaticos',
  'creacion final de compromisos no aprobados',
  'asignacion definitiva de responsables sin revision',
  'cambios de estado formales en sistemas de registro',
];
