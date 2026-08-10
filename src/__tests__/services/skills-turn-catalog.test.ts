import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildModelTools } from '../../services/gemini-chat/model-config';
import { isKnownGeminiTool } from '../../services/gemini-chat/tool-dispatch';
import {
  isKnownTurnTool,
  resolveSkillToolGroups,
  resolveSkillToolNames,
  type ActiveSkillContext,
} from '../../services/gemini-tools/turn-catalog';
import { filterSkillTools, isToolAllowedFromSkill } from '../../shared/skills/surface-tools';
import { buildSystemInstruction } from '../../services/gemini-chat/system-instruction';

const SKILL_CON_WORKSPACE: ActiveSkillContext = {
  id: 'sistema:presentaciones',
  tools: ['workspace_list_files', 'workspace_read_file', 'workspace_write_file', 'workspace_edit_file'],
  workspaceId: 'presentacion-abc123',
};

const SKILL_SIN_WORKSPACE: ActiveSkillContext = { ...SKILL_CON_WORKSPACE, workspaceId: null };

/** `buildModelTools` mezcla grupos de declaraciones con entradas nativas del SDK. */
type GrupoDeclaraciones = { functionDeclarations?: { name: string }[] };

function contarDeclaraciones(tools: unknown[]): string[] {
  return tools.flatMap((group) => ((group as GrupoDeclaraciones)?.functionDeclarations ?? []).map((tool) => tool.name));
}

describe('catalogo de herramientas por turno', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('sin skill activa', () => {
    it('el catalogo es identico al catalogo base', () => {
      const base = contarDeclaraciones(buildModelTools(false, 'gemini-3.6-flash'));
      const conSkillNula = contarDeclaraciones(buildModelTools(false, 'gemini-3.6-flash', null));

      expect(conSkillNula).toEqual(base);
      expect(base.some((name) => name.startsWith('workspace_'))).toBe(false);
    });

    it('no reconoce las herramientas de workspace', () => {
      expect(isKnownTurnTool('workspace_write_file')).toBe(false);
      expect(isKnownGeminiTool('workspace_write_file')).toBe(false);
    });

    it('sigue reconociendo las herramientas base', () => {
      expect(isKnownTurnTool('read_file')).toBe(true);
      expect(isKnownTurnTool('generate_image')).toBe(true);
    });
  });

  describe('con skill activa y workspace vivo', () => {
    it('declara las herramientas de workspace', () => {
      const nombres = contarDeclaraciones(buildModelTools(false, 'gemini-3.6-flash', SKILL_CON_WORKSPACE));

      expect(nombres).toContain('workspace_write_file');
      expect(nombres).toContain('workspace_edit_file');
      expect(nombres).toContain('workspace_read_file');
      expect(nombres).toContain('workspace_list_files');
    });

    it('reconoce las herramientas aportadas', () => {
      expect(isKnownTurnTool('workspace_edit_file', SKILL_CON_WORKSPACE)).toBe(true);
      expect(isKnownGeminiTool('workspace_edit_file', SKILL_CON_WORKSPACE)).toBe(true);
    });

    it('no altera las herramientas base', () => {
      const base = contarDeclaraciones(buildModelTools(false, 'gemini-3.6-flash'));
      const conSkill = contarDeclaraciones(buildModelTools(false, 'gemini-3.6-flash', SKILL_CON_WORKSPACE));

      expect(base.every((name) => conSkill.includes(name))).toBe(true);
    });
  });

  describe('con skill activa pero sin workspace', () => {
    it('no declara las herramientas de workspace', () => {
      const nombres = contarDeclaraciones(buildModelTools(false, 'gemini-3.6-flash', SKILL_SIN_WORKSPACE));

      expect(nombres.some((name) => name.startsWith('workspace_'))).toBe(false);
      expect(resolveSkillToolGroups(SKILL_SIN_WORKSPACE)).toHaveLength(0);
    });

    it('rechaza una invocacion de herramienta de workspace', () => {
      expect(isKnownTurnTool('workspace_write_file', SKILL_SIN_WORKSPACE)).toBe(false);
    });
  });

  describe('allowlist de superficie', () => {
    it('descarta una herramienta que la superficie no permite aportar', () => {
      const skill: ActiveSkillContext = {
        id: 'usuario:falsa',
        tools: ['workspace_write_file', 'use_computer', 'execute_command'],
        workspaceId: 'ws-1',
      };

      const resueltas = resolveSkillToolNames(skill);

      expect(resueltas).toContain('workspace_write_file');
      expect(resueltas).not.toContain('use_computer');
      expect(resueltas).not.toContain('execute_command');
    });

    it('una skill no puede aportar herramientas bloqueadas en WhatsApp', () => {
      expect(filterSkillTools('whatsapp', ['whatsapp_send_file', 'gmail_send'])).toEqual([]);
      expect(isToolAllowedFromSkill('whatsapp', 'use_computer')).toBe(false);
      expect(isToolAllowedFromSkill('whatsapp', 'workspace_write_file')).toBe(true);
    });

    it('una herramienta desconocida no se cuela por declararla', () => {
      expect(filterSkillTools('chat', ['herramienta_inventada'])).toEqual([]);
    });
  });
});

describe('instruccion de sistema con skill activa', () => {
  it('inyecta las instrucciones de la skill', () => {
    const instruction = buildSystemInstruction('haz una presentacion', {
      activeSkill: {
        id: 'sistema:presentaciones',
        name: 'Presentaciones',
        instructions: 'INSTRUCCIONES DE PRUEBA DE LA SKILL',
        tools: [],
        workspaceId: null,
      },
    });

    expect(instruction).toContain('SKILL ACTIVA: Presentaciones');
    expect(instruction).toContain('INSTRUCCIONES DE PRUEBA DE LA SKILL');
  });

  it('menciona el espacio de trabajo cuando existe', () => {
    const conWorkspace = buildSystemInstruction('hola', {
      activeSkill: { id: 's', name: 'S', instructions: 'x', tools: [], workspaceId: 'ws-1' },
    });
    const sinWorkspace = buildSystemInstruction('hola', {
      activeSkill: { id: 's', name: 'S', instructions: 'x', tools: [], workspaceId: null },
    });

    expect(conWorkspace).toContain('workspace_*');
    expect(sinWorkspace).not.toContain('workspace_*');
  });

  it('sin skill activa no anade ninguna seccion de skill', () => {
    const instruction = buildSystemInstruction('hola');

    expect(instruction).not.toContain('SKILL ACTIVA');
  });
});
