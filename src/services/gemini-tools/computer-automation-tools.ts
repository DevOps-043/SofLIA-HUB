import { booleanProp, emptyParams, numberProp, objectParams, stringProp } from './schema';
import type { GeminiFunctionDeclaration } from './types';

export const COMPUTER_AUTOMATION_TOOL_DECLARATIONS: GeminiFunctionDeclaration[] = [
  {
    name: 'use_computer',
    description: 'Ejecuta una tarea autonoma de computer use en backend browser, uia o desktop. El backend uia puede escalar automaticamente a desktop si no logra verificar cambios. El resultado incluye "outcome.estado": SOLO afirma al usuario que la tarea se completo si estado es "completada"; con "presupuesto_agotado", "fallida", "cancelada" o "cola_expirada" reporta el progreso real (outcome.mensaje) y pregunta si desea continuar. NUNCA anuncies exito antes de recibir este resultado.',
    parameters: objectParams({
      task: stringProp('Descripcion detallada de la tarea.'),
      max_steps: numberProp('Maximo de pasos.'),
      backend: stringProp('Opcional: auto, browser, uia o desktop.'),
      start_url: stringProp('URL inicial para una tarea web. Opcional.'),
      browser_profile: stringProp('Perfil persistente opcional para browser_web.'),
      browser_isolated: booleanProp('Si es true, fuerza una sesion web aislada.'),
      reset_browser_profile: booleanProp('Si es true, limpia el perfil web indicado antes de ejecutar.'),
    }, ['task']),
  },
  { name: 'list_browser_profiles', description: 'Lista los perfiles persistentes disponibles para browser_web.', parameters: emptyParams() },
  { name: 'reset_browser_profile', description: 'Borra un perfil persistente de browser_web.', parameters: objectParams({ profile_id: stringProp('ID del perfil a limpiar.') }, ['profile_id']) },
];
