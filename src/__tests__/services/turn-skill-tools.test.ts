import { describe, expect, it } from 'vitest';
import { resolveTurnSkill } from '../../adapters/desktop_ui/chat-ui/resolve-turn-skill';
import { toActiveSkillContext } from '../../services/skills/active-skill';
import { buildModelTools } from '../../services/gemini-chat/model-config';
import { shouldRunToolLoop } from '../../services/gemini-chat/tool-loop-decision';
import { PRESENTACIONES_SKILL, PRESENTACIONES_SKILL_ID } from '../../shared/skills/presentaciones-skill';
import type { ActiveSkillState } from '../../services/skills/active-skill';

/**
 * Cadena completa desde "la conversacion tiene una presentacion" hasta "el
 * modelo recibe workspace_write_file".
 *
 * El fallo que motiva esta suite se repitio tres veces: el usuario pedia un
 * cambio sobre una presentacion abierta y el modelo respondia que no tenia
 * acceso operativo a los archivos. Cada eslabon por separado estaba bien; lo
 * que fallaba era que la Skill del turno salia SOLO del estado del compositor,
 * y ese estado no sobrevive a un remonte del chat. Aqui se prueba la
 * invariante que importa: si el panel tiene la presentacion, el turno tiene
 * sus herramientas.
 */
describe('herramientas del turno con una presentacion abierta', () => {
  /** Nombres de herramienta que el catalogo del turno declara al modelo. */
  function nombresDeclarados(activeSkill: ActiveSkillState | null): string[] {
    const contexto = toActiveSkillContext(activeSkill);
    const grupos = buildModelTools(false, 'gemini-3.1-pro', contexto) as Array<{
      functionDeclarations?: Array<{ name: string }>;
    }>;
    return grupos.flatMap((grupo) => (grupo.functionDeclarations ?? []).map((declaracion) => declaracion.name));
  }

  it('deriva la skill del espacio de trabajo cuando el compositor la perdio', () => {
    const resuelta = resolveTurnSkill({
      activeSkill: null,
      workspaceId: 'ws-1',
      skillId: PRESENTACIONES_SKILL_ID,
    });

    expect(resuelta?.skill.id).toBe(PRESENTACIONES_SKILL_ID);
    expect(resuelta?.workspaceId).toBe('ws-1');
  });

  it('declara las herramientas de archivo al modelo', () => {
    const resuelta = resolveTurnSkill({
      activeSkill: null,
      workspaceId: 'ws-1',
      skillId: PRESENTACIONES_SKILL_ID,
    });

    const nombres = nombresDeclarados(resuelta);
    expect(nombres).toContain('workspace_list_files');
    expect(nombres).toContain('workspace_read_file');
    expect(nombres).toContain('workspace_write_file');
    expect(nombres).toContain('workspace_edit_file');
  });

  it('el turno corre el bucle de herramientas', () => {
    const resuelta = resolveTurnSkill({
      activeSkill: null,
      workspaceId: 'ws-1',
      skillId: PRESENTACIONES_SKILL_ID,
    });
    const contexto = toActiveSkillContext(resuelta);

    // Sin esto el modelo escribe la llamada como texto en vez de ejecutarla.
    expect(shouldRunToolLoop({
      skillToolCount: contexto?.tools.length ?? 0,
      requiresBrowserCapabilities: false,
      isReadOnlyBrowserObservation: true,
      isPureWebResearch: false,
      hasToolIntent: false,
    })).toBe(true);
  });

  it('le dice al modelo que compruebe antes de negarse', () => {
    const resuelta = resolveTurnSkill({
      activeSkill: null,
      workspaceId: 'ws-1',
      skillId: PRESENTACIONES_SKILL_ID,
    });

    // Es lo que respondia en vez de editar: "no puedo acceder a los archivos".
    expect(resuelta?.contextNote).toContain('NO afirmes que no puedes acceder');
    expect(resuelta?.contextNote).toContain('workspace_list_files');
  });

  it('completa el workspace de una skill elegida a mano que aun no lo tiene', () => {
    // La activacion es inmediata y la carpeta llega despues: sin completarlo,
    // ese turno intermedio declaraba la Skill sin destino donde escribir.
    const aMedias = {
      skill: PRESENTACIONES_SKILL,
      workspaceId: null,
      brandingNotice: null,
      workspaceError: null,
      contextNote: null,
    } as ActiveSkillState;

    const resuelta = resolveTurnSkill({ activeSkill: aMedias, workspaceId: 'ws-1', skillId: PRESENTACIONES_SKILL_ID });

    expect(resuelta?.workspaceId).toBe('ws-1');
    expect(nombresDeclarados(resuelta)).toContain('workspace_write_file');
  });

  it('respeta la skill elegida a mano y no la sustituye', () => {
    const elegida = {
      skill: PRESENTACIONES_SKILL,
      workspaceId: 'ws-elegido',
      brandingNotice: null,
      workspaceError: null,
      contextNote: 'nota original',
    } as ActiveSkillState;

    const resuelta = resolveTurnSkill({ activeSkill: elegida, workspaceId: 'ws-otro', skillId: PRESENTACIONES_SKILL_ID });

    expect(resuelta?.workspaceId).toBe('ws-elegido');
    expect(resuelta?.contextNote).toBe('nota original');
  });

  it('sin presentacion en la conversacion no declara nada de workspace', () => {
    const resuelta = resolveTurnSkill({ activeSkill: null, workspaceId: null, skillId: null });

    expect(resuelta).toBeNull();
    expect(nombresDeclarados(resuelta)).not.toContain('workspace_write_file');
  });
});
