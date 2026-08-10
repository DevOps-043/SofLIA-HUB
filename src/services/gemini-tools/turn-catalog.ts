import { filterSkillTools } from '../../shared/skills/surface-tools';
import { isSkillWorkspaceToolName } from '../../shared/skills/workspace-tool-names';
import { SKILL_WORKSPACE_TOOLS } from './skill-workspace-tools';
import {
  COMPUTER_TOOL_NAMES,
  GOOGLE_WORKSPACE_TOOL_NAMES,
  INTEGRATED_BROWSER_TOOL_NAMES,
  NATIVE_AI_TOOL_NAMES,
  PROJECT_HUB_TOOL_NAMES,
} from './tool-names';
import type { GeminiToolGroup } from './types';

/**
 * Catalogo de herramientas del TURNO: catalogo base de la superficie mas las
 * herramientas que aporta la Skill activa.
 *
 * Antes el catalogo era estatico (`Set`s de modulo) y no habia forma de que
 * una Skill aportara herramientas sin ampliarlo para todos los turnos. Sin
 * Skill activa, el resultado es identico al catalogo base de siempre.
 */

/** Skill activa del turno, tal como la resuelve el chat. */
export interface ActiveSkillContext {
  id: string;
  /** Herramientas declaradas por la Skill (aun sin filtrar por superficie). */
  tools: readonly string[];
  /**
   * Workspace vivo. Sin el, las herramientas de workspace NO se declaran: un
   * catalogo que ofrece escritura sin destino valido es un fallo permanente.
   */
  workspaceId: string | null;
}

const BASE_TOOL_NAMES: ReadonlySet<string>[] = [
  COMPUTER_TOOL_NAMES,
  PROJECT_HUB_TOOL_NAMES,
  GOOGLE_WORKSPACE_TOOL_NAMES,
  INTEGRATED_BROWSER_TOOL_NAMES,
  NATIVE_AI_TOOL_NAMES,
];

/** Herramientas efectivas que aporta la Skill activa en el chat. */
export function resolveSkillToolNames(activeSkill?: ActiveSkillContext | null): string[] {
  if (!activeSkill) return [];
  const permitted = filterSkillTools('chat', activeSkill.tools);
  // Las de workspace requieren workspace vivo; el resto pasa tal cual.
  return permitted.filter((tool) => !isSkillWorkspaceToolName(tool) || Boolean(activeSkill.workspaceId));
}

/** Grupos de declaraciones que la Skill activa anade a los del modelo. */
export function resolveSkillToolGroups(activeSkill?: ActiveSkillContext | null): GeminiToolGroup[] {
  const names = new Set(resolveSkillToolNames(activeSkill));
  if (names.size === 0) return [];

  const groups: GeminiToolGroup[] = [];
  const workspaceDeclarations = SKILL_WORKSPACE_TOOLS.functionDeclarations.filter((tool) => names.has(tool.name));
  if (workspaceDeclarations.length > 0) groups.push({ functionDeclarations: workspaceDeclarations });
  return groups;
}

/** Una herramienta es conocida si esta en el catalogo base o la aporta la Skill. */
export function isKnownTurnTool(toolName: string, activeSkill?: ActiveSkillContext | null): boolean {
  if (BASE_TOOL_NAMES.some((names) => names.has(toolName))) return true;
  return resolveSkillToolNames(activeSkill).includes(toolName);
}

export function isBaseTool(toolName: string): boolean {
  return BASE_TOOL_NAMES.some((names) => names.has(toolName));
}
