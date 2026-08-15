import type { SkillSurface } from './types';
import { SKILL_WORKSPACE_TOOL_NAMES } from './workspace-tool-names';

/**
 * Allowlist de herramientas que una Skill puede APORTAR en cada superficie.
 *
 * Regla de gobierno: una Skill activa lo que la superficie permite pero no
 * ofrece por defecto; nunca amplia lo que la superficie prohibe. Sin esta
 * lista, declarar una herramienta en el registro de Skills bastaria para
 * saltarse las guardas de WhatsApp.
 *
 * Por que las Skills que sustituyen a los flujos de Correo, Agenda y Drive NO
 * anaden nada aqui: las herramientas de Google Workspace YA estan en el
 * catalogo runtime de las tres superficies. Una Skill que las declarara no
 * concederia nada nuevo, y para lograrlo habria que abrir esta lista a un
 * dominio entero. Esas Skills aportan instrucciones, que es exactamente lo que
 * las distingue del flujo que sustituyen.
 */
const ALLOWED_BY_SURFACE: Record<SkillSurface, ReadonlySet<string>> = {
  chat: new Set(SKILL_WORKSPACE_TOOL_NAMES),
  whatsapp: new Set(SKILL_WORKSPACE_TOOL_NAMES),
  telegram: new Set(SKILL_WORKSPACE_TOOL_NAMES),
};

/**
 * Herramientas que NINGUNA Skill puede aportar en ninguna superficie, aunque
 * las declare. Son capacidades cuya activacion debe decidirla el producto y
 * no una declaracion de Skill.
 *
 * La lista crece con este cambio porque las Skills pasan a cubrir los dominios
 * de correo, calendario y Drive que antes eran flujos. Todas las anadidas
 * comparten un rasgo: su efecto no se deshace desde el chat. Enviar un correo o
 * un mensaje a un espacio sale de la organizacion; vaciar etiquetas o mover a
 * la papelera altera el buzon; crear o borrar un evento cambia la agenda de
 * otras personas. Que el agente pueda ejecutarlas —con sus confirmaciones— no
 * implica que una fila del catalogo pueda concederselas a si misma.
 */
const NEVER_FROM_SKILLS: ReadonlySet<string> = new Set([
  'use_computer',
  'use_computer_on_node',
  'execute_command',
  'delete_item',
  'gmail_send',
  'whatsapp_send_file',
  // Salida hacia fuera de la organizacion.
  'gchat_send_message',
  // Escritura sobre el buzon del usuario.
  'gmail_trash',
  'gmail_modify_labels',
  'gmail_create_label',
  'gmail_delete_label',
  'gmail_batch_empty_label',
  'gmail_empty_all_labels',
  'gmail_apply_organization_plan',
  'gmail_undo_organization_plan',
  // Escritura sobre Drive y el calendario.
  'drive_upload',
  'drive_create_folder',
  'google_calendar_create',
  'google_calendar_delete',
]);

/**
 * Filtra las herramientas declaradas por una Skill contra la superficie.
 * Devuelve solo las permitidas; las descartadas se registran para que un
 * error de declaracion sea visible en desarrollo.
 */
export function filterSkillTools(surface: SkillSurface, tools: readonly string[]): string[] {
  const allowed = ALLOWED_BY_SURFACE[surface] ?? new Set<string>();
  const accepted: string[] = [];

  for (const tool of tools) {
    if (NEVER_FROM_SKILLS.has(tool) || !allowed.has(tool)) {
      console.warn(`[Skills] La herramienta "${tool}" no puede aportarse desde una skill en ${surface}; se descarta.`);
      continue;
    }
    accepted.push(tool);
  }

  return accepted;
}

export function isToolAllowedFromSkill(surface: SkillSurface, tool: string): boolean {
  if (NEVER_FROM_SKILLS.has(tool)) return false;
  return (ALLOWED_BY_SURFACE[surface] ?? new Set<string>()).has(tool);
}

/**
 * Herramientas que el USUARIO puede seleccionar para su propia Skill.
 *
 * Es una lista distinta de `NEVER_FROM_SKILLS`, y mas amplia, porque responde a
 * otra pregunta. Aquella responde "¿que puede declarar una FILA del catalogo?",
 * escrita por un operador y potencialmente influida por una fuente externa; por
 * eso le niega todo lo que actua hacia fuera. Esta responde "¿que puede elegir
 * el DUENO de la Skill, en su configuracion, con su sesion y sobre su propio
 * equipo?", y ahi negarle el correo o su computadora seria absurdo.
 *
 * Que sea mas amplia NO la hace peligrosa, y el motivo es que la seleccion solo
 * INTERSECA (ver `tool-selection.ts`): nunca concede nada que la superficie no
 * ofreciera ya, nunca salta la autorizacion del canal y nunca retira una
 * confirmacion.
 *
 * Queda fuera lo que no es una decision "por Skill":
 *  - `whatsapp_send_file`: pertenece a la superficie, no a la Skill.
 *  - Nodos remotos: dependen del inventario de nodos, no de esta pantalla.
 */
const NOT_SELECTABLE_BY_USER: ReadonlySet<string> = new Set([
  'whatsapp_send_file',
  'use_computer_on_node',
  'open_application_on_node',
  'run_background_command_on_node',
  'take_screenshot_on_node',
  'list_remote_nodes',
  'register_remote_node',
  'remove_remote_node',
  'test_remote_node',
  'configure_remote_node_host',
  'get_remote_node_host_status',
  'list_remote_node_process_sessions',
  'poll_remote_node_process_session',
]);

export function isToolSelectableByUser(tool: string): boolean {
  return !NOT_SELECTABLE_BY_USER.has(tool);
}
