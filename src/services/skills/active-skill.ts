import { buildPresentacionesContextNote } from '../../prompts/skills/presentaciones';
import { PRESENTACIONES_SKILL_ID } from '../../shared/skills/presentaciones-skill';
import { isSystemSkill, type Skill } from '../../shared/skills/types';
import { presentationApi, workspaceApi } from './workspace-bridge';

/**
 * Ciclo de vida del espacio de trabajo de la Skill activa.
 *
 * Una Skill del sistema con politica de workspace necesita una carpeta viva
 * antes de que el modelo pueda escribir: sin ella, sus herramientas no se
 * declaran (ver `turn-catalog.ts`). Este modulo la crea o la recupera y
 * prepara la hoja de marca.
 */

export interface ActiveSkillState {
  skill: Skill;
  workspaceId: string | null;
  /** Aviso para el usuario cuando la identidad corporativa no se aplico. */
  brandingNotice: string | null;
  /**
   * Motivo por el que la Skill no tiene espacio de trabajo pese a declararlo.
   * Nulo cuando todo fue bien o cuando la Skill no necesita workspace.
   */
  workspaceError: string | null;
  /**
   * Nota que se antepone a las instrucciones de la Skill para decirle al
   * modelo con que contexto arranca. Sin ella preguntaria por informacion que
   * ya tiene delante.
   */
  contextNote: string | null;
}

/** Senales de contexto que decide el chat al activar la Skill. */
export interface SkillActivationContext {
  hasConversation: boolean;
  hasBrowserPage: boolean;
  hasAttachments: boolean;
  organizationName: string | null;
}

/**
 * Prepara el workspace de una Skill: recupera el de la conversacion si ya
 * existe, o crea uno nuevo y escribe la hoja de marca de la organizacion.
 */
export async function prepareSkillWorkspace(input: {
  skill: Skill;
  conversationId: string | null;
  organizationId: string | null;
  context: SkillActivationContext;
  title?: string;
}): Promise<ActiveSkillState> {
  const { skill } = input;
  const policy = isSystemSkill(skill) ? skill.workspace : null;
  const inerte = (workspaceError: string | null): ActiveSkillState => ({
    skill,
    workspaceId: null,
    brandingNotice: null,
    workspaceError,
    contextNote: buildContextNote(skill, input.context, null, workspaceError),
  });

  if (!policy) return inerte(null);

  const api = workspaceApi();
  if (!api) {
    // Fuera del escritorio no existe el puente de archivos. Se declara el
    // motivo en vez de dejar la Skill activa aparentando que puede escribir.
    return inerte('El espacio de trabajo solo esta disponible en la aplicacion de escritorio.');
  }

  const existing = input.conversationId ? await api.findByConversation(input.conversationId) : null;
  if (existing?.workspace?.id) {
    return {
      skill,
      workspaceId: existing.workspace.id,
      brandingNotice: null,
      workspaceError: null,
      contextNote: buildContextNote(skill, input.context, null, null),
    };
  }

  const created = await api.create({
    skillId: skill.id,
    title: input.title?.trim() || skill.name,
    conversationId: input.conversationId,
    policy,
  });
  if (!created.success || !created.workspace) {
    console.error('[Skills] No se pudo crear el espacio de trabajo:', created.error);
    return inerte(created.error || 'No se pudo crear el espacio de trabajo.');
  }

  const brandingNotice = await prepareBranding(created.workspace.id, input.organizationId);
  return {
    skill,
    workspaceId: created.workspace.id,
    brandingNotice,
    workspaceError: null,
    contextNote: buildContextNote(skill, input.context, brandingNotice, null),
  };
}

/**
 * Nota de contexto de la Skill activa. Hoy solo la de presentaciones la
 * necesita; otras Skills del sistema pueden anadir la suya aqui sin tocar el
 * ciclo de vida del workspace.
 */
function buildContextNote(
  skill: Skill,
  context: SkillActivationContext,
  brandingNotice: string | null,
  workspaceError: string | null,
): string | null {
  if (skill.id !== PRESENTACIONES_SKILL_ID) return null;
  const nota = buildPresentacionesContextNote({ ...context, brandingNotice });
  if (!workspaceError) return nota;
  // El modelo debe SABER que no puede escribir, para decirlo en vez de
  // simular llamadas a herramientas que no tiene.
  return `${nota}

AVISO: no hay espacio de trabajo disponible (${workspaceError}). No puedes crear archivos en este turno. Dilo con claridad y no simules haberlos creado.`;
}

/**
 * Escribe la hoja de variables de marca. Un fallo aqui no impide generar: la
 * presentacion sale con el tema neutro y el usuario recibe el aviso.
 */
async function prepareBranding(workspaceId: string, organizationId: string | null): Promise<string | null> {
  const api = presentationApi();
  if (!api) return null;

  const response = await api.prepareBranding({ workspaceId, organizationId });
  if (!response.success || !response.branding) {
    return 'No pude aplicar la identidad de tu organizacion; la presentacion usara el tema neutro.';
  }

  // Main ya redacta el aviso (incluido "tome la paleta del logo"); aqui solo
  // se propaga para no duplicar el criterio en dos sitios.
  return response.branding.notice ?? null;
}

/** Contexto que el turno pasa al modelo para la Skill activa. */
export function toActiveSkillContext(state: ActiveSkillState | null) {
  if (!state) return undefined;
  return {
    id: state.skill.id,
    name: state.skill.name,
    // La nota de contexto va ANTES de las instrucciones: el modelo debe saber
    // en que caso del protocolo esta antes de leer que hacer.
    instructions: state.contextNote
      ? `${state.contextNote}

${state.skill.instructions}`
      : state.skill.instructions,
    tools: isSystemSkill(state.skill) ? state.skill.tools : [],
    workspaceId: state.workspaceId,
  };
}
