import { describe, expect, it } from 'vitest';
import { shouldRunToolLoop, type ToolLoopSignals } from '../../services/gemini-chat/tool-loop-decision';
import { buildModelTools } from '../../services/gemini-chat/model-config';
import { PRESENTACIONES_SKILL } from '../../shared/skills/presentaciones-skill';
import type { ActiveSkillContext } from '../../services/gemini-tools/turn-catalog';

/**
 * Regresion del fallo observado en el chat flotante del navegador: al pedir
 * "haz una presentacion de la pagina que tengo abierta", el turno se
 * clasificaba como observacion de solo lectura del navegador, el bucle de
 * herramientas quedaba desactivado y el modelo NO recibia ninguna
 * herramienta. Sin nada que ejecutar, escribio las llamadas como texto
 * (`<tool_call> to=read_browser_dom`) y despues dijo que no tenia espacio de
 * trabajo.
 */

/** Turno tal como llega desde el chat flotante con el navegador abierto. */
const OBSERVACION_NAVEGADOR: ToolLoopSignals = {
  skillToolCount: 0,
  requiresBrowserCapabilities: false,
  isReadOnlyBrowserObservation: true,
  isPureWebResearch: false,
  hasToolIntent: false,
};

describe('decision del bucle de herramientas', () => {
  it('una Skill con herramientas lo activa pese a la observacion del navegador', () => {
    // Este es exactamente el caso que fallaba.
    expect(shouldRunToolLoop({ ...OBSERVACION_NAVEGADOR, skillToolCount: 4 })).toBe(true);
  });

  it('sin Skill, una observacion de solo lectura sigue sin bucle', () => {
    // Comportamiento correcto que no debe cambiar: "que ves en la pagina" se
    // responde con la captura adjunta, sin gastar herramientas.
    expect(shouldRunToolLoop(OBSERVACION_NAVEGADOR)).toBe(false);
  });

  it('una Skill sin herramientas no lo activa', () => {
    // Una Skill del usuario solo aporta instrucciones: no hay que ejecutar nada.
    expect(shouldRunToolLoop({ ...OBSERVACION_NAVEGADOR, skillToolCount: 0 })).toBe(false);
  });

  it('la investigacion web pura sigue sin bucle', () => {
    expect(shouldRunToolLoop({
      skillToolCount: 0,
      requiresBrowserCapabilities: false,
      isReadOnlyBrowserObservation: false,
      isPureWebResearch: true,
      hasToolIntent: true,
    })).toBe(false);
  });

  it('una Skill con herramientas gana tambien sobre la investigacion pura', () => {
    expect(shouldRunToolLoop({
      skillToolCount: 4,
      requiresBrowserCapabilities: false,
      isReadOnlyBrowserObservation: false,
      isPureWebResearch: true,
      hasToolIntent: false,
    })).toBe(true);
  });

  it('el navegador sin observacion utilizable lo sigue activando', () => {
    expect(shouldRunToolLoop({ ...OBSERVACION_NAVEGADOR, requiresBrowserCapabilities: true })).toBe(true);
  });

  it('la intencion por palabras clave lo activa en un turno normal', () => {
    expect(shouldRunToolLoop({
      skillToolCount: 0,
      requiresBrowserCapabilities: false,
      isReadOnlyBrowserObservation: false,
      isPureWebResearch: false,
      hasToolIntent: true,
    })).toBe(true);
  });
});

describe('la skill de presentaciones activa el bucle', () => {
  it('declara herramientas, por lo que el turno nunca se queda sin ellas', () => {
    // Si alguien vaciara `tools` en la declaracion de la Skill, el bucle
    // dejaria de activarse y volveria el fallo original.
    expect(PRESENTACIONES_SKILL.tools.length).toBeGreaterThan(0);
    expect(shouldRunToolLoop({
      ...OBSERVACION_NAVEGADOR,
      skillToolCount: PRESENTACIONES_SKILL.tools.length,
    })).toBe(true);
  });
});

describe('herramientas declaradas al modelo', () => {
  const SKILL: ActiveSkillContext = {
    id: PRESENTACIONES_SKILL.id,
    tools: [...PRESENTACIONES_SKILL.tools],
    workspaceId: 'presentacion-abc123',
  };

  function nombres(tools: unknown[]): string[] {
    return tools.flatMap((group) => (
      ((group as { functionDeclarations?: { name: string }[] })?.functionDeclarations ?? []).map((tool) => tool.name)
    ));
  }

  it('con workspace vivo el modelo recibe las de escritura', () => {
    const declaradas = nombres(buildModelTools(false, 'gemini-3.6-flash', SKILL));

    expect(declaradas).toContain('workspace_write_file');
    expect(declaradas).toContain('workspace_edit_file');
  });

  it('sin workspace vivo no se declara ninguna de escritura', () => {
    const declaradas = nombres(buildModelTools(false, 'gemini-3.6-flash', { ...SKILL, workspaceId: null }));

    expect(declaradas.some((name) => name.startsWith('workspace_'))).toBe(false);
  });
});
