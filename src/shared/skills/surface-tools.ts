import type { SkillSurface } from './types';
import { SKILL_WORKSPACE_TOOL_NAMES } from './workspace-tool-names';

/**
 * Allowlist de herramientas que una Skill puede APORTAR en cada superficie.
 *
 * Regla de gobierno: una Skill activa lo que la superficie permite pero no
 * ofrece por defecto; nunca amplia lo que la superficie prohibe. Sin esta
 * lista, declarar una herramienta en el registro de Skills bastaria para
 * saltarse las guardas de WhatsApp.
 */
const ALLOWED_BY_SURFACE: Record<SkillSurface, ReadonlySet<string>> = {
  chat: new Set(SKILL_WORKSPACE_TOOL_NAMES),
  whatsapp: new Set(SKILL_WORKSPACE_TOOL_NAMES),
};

/**
 * Herramientas que NINGUNA Skill puede aportar en ninguna superficie, aunque
 * las declare. Son capacidades cuya activacion debe decidirla el producto y
 * no una declaracion de Skill.
 */
const NEVER_FROM_SKILLS: ReadonlySet<string> = new Set([
  'use_computer',
  'use_computer_on_node',
  'execute_command',
  'delete_item',
  'gmail_send',
  'whatsapp_send_file',
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
