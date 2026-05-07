/**
 * Constantes del agentic loop de WhatsApp.
 *
 * Sin lógica — solo umbrales, modelos y sets de tools categorizados por
 * tipo de evidencia que producen. Estos sets se usan en el loop guard
 * (detección de bucles) y en el sistema de evidence tracking que decide
 * cómo mostrar resultados al usuario.
 */

export const MAX_HISTORY = 20;

/** Modelo Gemini estable usado por el agente WhatsApp. */
export const WA_MODEL = 'gemini-2.5-flash';

/**
 * Umbrales del loop guard:
 *  - REPEAT: cuántas veces seguidas una llamada idéntica activa warning
 *  - CRITICAL: a partir de cuántas iteraciones se aborta el loop
 */
export const LOOP_GUARD_REPEAT_THRESHOLD = 3;
export const LOOP_GUARD_CRITICAL_THRESHOLD = 5;

/**
 * Tools que solo "consultan estado" y no deberían contar contra el loop
 * guard — son polls legítimos esperables en muchas iteraciones.
 */
export const POLL_LIKE_TOOLS = new Set([
  'poll_process_session',
  'list_process_sessions',
  'list_active_tasks',
  'autodev_status',
  'get_background_host_status',
]);

/**
 * Tools que producen evidencia local (texto/datos del filesystem o sistema
 * del usuario). El agente no debe pedirle al usuario que repita info que
 * estas tools ya pueden traer.
 */
export const LOCAL_EVIDENCE_TOOLS = new Set([
  'use_computer',
  'take_screenshot',
  'take_screenshot_and_send',
  'execute_command',
  'read_file',
  'list_directory',
  'list_directory_summary',
  'search_files',
  'semantic_file_search',
  'get_file_info',
]);

/**
 * Subconjunto de LOCAL_EVIDENCE_TOOLS que produce evidencia VISUAL —
 * captura de pantalla del estado actual del usuario. Útil para distinguir
 * entre "leer texto del FS" y "ver lo que está mirando el usuario".
 */
export const LOCAL_VISUAL_EVIDENCE_TOOLS = new Set([
  'use_computer',
  'take_screenshot',
  'take_screenshot_and_send',
]);

/**
 * Tools que traen evidencia REMOTA (web, internet). El modelo debería
 * priorizar estas cuando el usuario pregunta sobre temas no locales.
 */
export const REMOTE_EVIDENCE_TOOLS = new Set([
  'open_url',
  'web_search',
  'web_search_advanced',
  'read_webpage',
]);
