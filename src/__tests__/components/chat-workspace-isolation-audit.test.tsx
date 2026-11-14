import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSkillWorkspaceResume } from '../../adapters/desktop_ui/chat-ui/useSkillWorkspaceResume';
import { useSkillWorkspaceLink } from '../../adapters/desktop_ui/chat-ui/useSkillWorkspaceLink';
import { useChatTools } from '../../adapters/desktop_ui/chat-ui/useChatTools';
import { PRESENTACIONES_SKILL } from '../../shared/skills/presentaciones-skill';
import type { ActiveSkillState } from '../../services/skills/active-skill';
import type { useChatUIState } from '../../adapters/desktop_ui/chat-ui/useChatUIState';

const mocks = vi.hoisted(() => ({ prepare: vi.fn() }));
vi.mock('../../services/skills/active-skill', () => ({ prepareSkillWorkspace: mocks.prepare }));
vi.mock('../../services/skills/user-skills-store', () => ({ markUserSkillUsed: vi.fn() }));
afterEach(() => { Reflect.deleteProperty(window, 'skillWorkspace'); vi.clearAllMocks(); });

const active: ActiveSkillState = { skill: PRESENTACIONES_SKILL, workspaceId: 'workspace-presentacion', brandingNotice: null, workspaceError: null, contextNote: null };

// Regresiones de aislamiento con consultas y activaciones retrasadas.
describe('auditoría del aislamiento de la Skill entre chats', () => {
  it('retira el workspace anterior antes de esperar la consulta del nuevo chat', () => {
    Reflect.set(window, 'skillWorkspace', { findByConversation: vi.fn(() => new Promise(() => {})) });
    const setActiveSkill = vi.fn();
    const resolved = vi.fn();
    const hook = renderHook(({ id }) => useSkillWorkspaceResume({ conversationId: id, activeSkill: active, setActiveSkill, onWorkspaceResolved: resolved }), { initialProps: { id: 'presentacion' } });
    hook.rerender({ id: 'apoyo-emocional' });
    expect(setActiveSkill).toHaveBeenCalledWith(null);
    expect(resolved).toHaveBeenCalledWith(null);
  });

  it('abrir un chat existente desde un borrador no le adjudica la presentación suelta', () => {
    const attachConversation = vi.fn(async () => ({ success: true }));
    Reflect.set(window, 'skillWorkspace', { attachConversation });
    const hook = renderHook(({ id }: { id: string | null }) => useSkillWorkspaceLink({ conversationId: id, workspaceId: 'workspace-suelto' }), { initialProps: { id: null as string | null } });
    hook.rerender({ id: 'apoyo-emocional-existente' });
    expect(attachConversation).not.toHaveBeenCalled();
  });

  it('descarta la activación de una Skill que terminó después de cambiar de chat', async () => {
    let complete!: (value: ActiveSkillState) => void;
    mocks.prepare.mockReturnValue(new Promise<ActiveSkillState>(resolve => { complete = resolve; }));
    const setActiveSkill = vi.fn();
    const ready = vi.fn();
    const state = { skillModals: { setLibraryOpen: vi.fn(), setActiveSkill } } as unknown as ReturnType<typeof useChatUIState>;
    const hook = renderHook(({ id }) => useChatTools(true, state, {
      conversationId: id, organizationId: 'organizacion', organizationName: 'Organización', onWorkspaceReady: ready,
      activation: { hasConversation: true, hasBrowserPage: false, hasAttachments: false, organizationName: 'Organización' },
    }), { initialProps: { id: 'presentacion' } });
    let pending!: Promise<void>;
    act(() => { pending = hook.result.current.handleUseSkill(PRESENTACIONES_SKILL); });
    hook.rerender({ id: 'apoyo-emocional' });
    setActiveSkill.mockClear();
    await act(async () => { complete(active); await pending; });
    expect(setActiveSkill).not.toHaveBeenCalled();
    expect(ready).not.toHaveBeenCalled();
  });
});
