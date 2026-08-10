import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSkillWorkspaceResume } from '../../adapters/desktop_ui/chat-ui/useSkillWorkspaceResume';
import { PRESENTACIONES_SKILL } from '../../shared/skills/presentaciones-skill';
import type { ActiveSkillState } from '../../services/skills/active-skill';

/**
 * Reproduce el fallo reportado: tras generar una presentacion, pedir un cambio
 * llegaba al modelo SIN herramientas de workspace —solo se declaran mientras
 * hay Skill activa— y respondia que no tenia acceso a los archivos, con la
 * carpeta intacta en disco.
 */
describe('reanudacion del espacio de trabajo de una conversacion', () => {
  const workspace = {
    id: 'ws-1',
    skillId: PRESENTACIONES_SKILL.id,
    conversationId: 'conv-1',
    title: 'Modelo de evolucion',
    entryFile: 'index.html',
    createdAt: '2026-08-07T00:00:00.000Z',
    updatedAt: '2026-08-07T00:00:00.000Z',
  };
  let findByConversation: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    findByConversation = vi.fn().mockResolvedValue({ success: true, workspace });
    (window as unknown as { skillWorkspace: unknown }).skillWorkspace = { findByConversation };
  });

  afterEach(() => {
    delete (window as unknown as { skillWorkspace?: unknown }).skillWorkspace;
  });

  it('reactiva la skill cuando la conversacion ya tiene entregable', async () => {
    const setActiveSkill = vi.fn();
    const onWorkspaceResolved = vi.fn();

    renderHook(() => useSkillWorkspaceResume({
      conversationId: 'conv-1',
      activeSkill: null,
      setActiveSkill,
      onWorkspaceResolved,
    }));

    await waitFor(() => expect(setActiveSkill).toHaveBeenCalledTimes(1));
    const restaurada = setActiveSkill.mock.calls[0][0] as ActiveSkillState;
    expect(restaurada.skill.id).toBe(PRESENTACIONES_SKILL.id);
    expect(restaurada.workspaceId).toBe('ws-1');
    expect(onWorkspaceResolved).toHaveBeenCalledWith({ id: 'ws-1', skillId: PRESENTACIONES_SKILL.id });
  });

  it('avisa al modelo de que continua un trabajo, no de que empieza uno', async () => {
    const setActiveSkill = vi.fn();

    renderHook(() => useSkillWorkspaceResume({ conversationId: 'conv-1', activeSkill: null, setActiveSkill }));

    await waitFor(() => expect(setActiveSkill).toHaveBeenCalled());
    const nota = (setActiveSkill.mock.calls[0][0] as ActiveSkillState).contextNote ?? '';
    // Sin esto volveria a preguntar el tema y a regenerar la baraja entera.
    expect(nota).toContain('CONTINUACION');
    expect(nota).toContain('No vuelvas a preguntar');
  });

  it('no pisa una skill que ya esta activa', async () => {
    const setActiveSkill = vi.fn();
    const activa = { skill: PRESENTACIONES_SKILL, workspaceId: 'ws-9' } as ActiveSkillState;

    renderHook(() => useSkillWorkspaceResume({ conversationId: 'conv-1', activeSkill: activa, setActiveSkill }));

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(findByConversation).not.toHaveBeenCalled();
    expect(setActiveSkill).not.toHaveBeenCalled();
  });

  it('no vuelve a imponerla si el usuario la desactiva en la misma conversacion', async () => {
    const setActiveSkill = vi.fn();
    const { rerender } = renderHook(
      (props: { activeSkill: ActiveSkillState | null }) => useSkillWorkspaceResume({
        conversationId: 'conv-1',
        activeSkill: props.activeSkill,
        setActiveSkill,
      }),
      { initialProps: { activeSkill: null as ActiveSkillState | null } },
    );

    await waitFor(() => expect(setActiveSkill).toHaveBeenCalledTimes(1));
    // El usuario la activa y luego la quita a proposito.
    rerender({ activeSkill: { skill: PRESENTACIONES_SKILL, workspaceId: 'ws-1' } as ActiveSkillState });
    rerender({ activeSkill: null });

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(setActiveSkill).toHaveBeenCalledTimes(1);
  });

  it('en una conversacion sin entregable desapunta el panel', async () => {
    findByConversation.mockResolvedValue({ success: true, workspace: null });
    const setActiveSkill = vi.fn();
    const onWorkspaceResolved = vi.fn();

    renderHook(() => useSkillWorkspaceResume({
      conversationId: 'conv-2',
      activeSkill: null,
      setActiveSkill,
      onWorkspaceResolved,
    }));

    await waitFor(() => expect(onWorkspaceResolved).toHaveBeenCalledWith(null));
    // Sin esto el menu reabria la presentacion de la conversacion anterior.
    expect(setActiveSkill).not.toHaveBeenCalled();
  });

  it('no falla fuera del escritorio, donde no existe el puente de archivos', async () => {
    delete (window as unknown as { skillWorkspace?: unknown }).skillWorkspace;
    const setActiveSkill = vi.fn();

    expect(() => renderHook(() => useSkillWorkspaceResume({
      conversationId: 'conv-1',
      activeSkill: null,
      setActiveSkill,
    }))).not.toThrow();
    expect(setActiveSkill).not.toHaveBeenCalled();
  });
});
