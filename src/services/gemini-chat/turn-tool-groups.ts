import { MULTIMODAL_FEATURES } from '../../shared/multimodal-input';
import {
  COMPUTER_USE_TOOLS,
  GOOGLE_WORKSPACE_TOOLS,
  INTEGRATED_BROWSER_TOOLS,
  NATIVE_AI_TOOLS,
  PROJECT_HUB_TOOLS,
} from '../gemini-tools';
import { filterDeclarationsBySelection, resolveSkillToolGroups, resolveAttachedSourceToolGroups, type ActiveSkillContext } from '../gemini-tools/turn-catalog';
import type { GeminiToolGroup } from '../gemini-tools/types';

const VISION_TOOL_NAMES = new Set(['capturar_vista_navegador', 'analizar_video_pestana']);

function withoutVisionTools(group: GeminiToolGroup): GeminiToolGroup {
  return {
    ...group,
    functionDeclarations: group.functionDeclarations.filter((tool) => !VISION_TOOL_NAMES.has(tool.name)),
  };
}

export function buildTurnToolGroups(
  computerUseEnabled: boolean,
  activeSkill?: ActiveSkillContext | null,
  attachedSourcesOnly = false,
): GeminiToolGroup[] {
  if (attachedSourcesOnly) return resolveAttachedSourceToolGroups(activeSkill);
  const hasGoogleWorkspace = typeof window !== 'undefined' && Boolean(window.calendar);
  const base: GeminiToolGroup[] = computerUseEnabled
    ? [COMPUTER_USE_TOOLS, PROJECT_HUB_TOOLS, NATIVE_AI_TOOLS]
    : [PROJECT_HUB_TOOLS, NATIVE_AI_TOOLS];
  if (hasGoogleWorkspace) base.push(GOOGLE_WORKSPACE_TOOLS);
  if (typeof window !== 'undefined' && !!window.integratedBrowser) {
    base.push(MULTIMODAL_FEATURES.browserVision ? INTEGRATED_BROWSER_TOOLS : withoutVisionTools(INTEGRATED_BROWSER_TOOLS));
  }

  // Seleccion del usuario para esta Skill: acota el catalogo ANTES de enviarlo.
  // Un grupo que se queda sin declaraciones no se envia: un `functionDeclarations`
  // vacio es una entrada invalida para el proveedor.
  const tools = base
    .map((group) => ({
      ...group,
      functionDeclarations: filterDeclarationsBySelection(
        group.functionDeclarations,
        activeSkill?.allowedTools,
      ),
    }))
    .filter((group) => group.functionDeclarations.length > 0);
  // Herramientas de la Skill activa. Sin Skill (o sin workspace vivo) el
  // catalogo queda exactamente igual que antes de este cambio.
  tools.push(...resolveSkillToolGroups(activeSkill));
  return tools;
}
