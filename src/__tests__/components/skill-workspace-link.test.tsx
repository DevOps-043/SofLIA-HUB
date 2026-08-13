import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSkillWorkspaceLink } from '../../adapters/desktop_ui/chat-ui/useSkillWorkspaceLink';

/**
 * Reproduce el fallo reportado: la presentacion se generaba bien, pero al
 * volver a ese chat no habia forma de abrirla.
 *
 * La causa es de orden. En un chat nuevo la Skill se activa ANTES de que
 * exista la conversacion —esta se crea al guardar el primer mensaje—, asi que
 * el workspace nacia con `conversationId` nulo y nadie lo ataba despues. Al
 * reabrir el chat, la busqueda por conversacion no encontraba nada y la entrada
 * "Presentacion" del menu de herramientas ni siquiera se ofrecia.
 */
describe('enlace del espacio de trabajo con la conversacion', () => {
  let attachConversation: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    attachConversation = vi.fn().mockResolvedValue({ success: true });
    (window as unknown as { skillWorkspace: unknown }).skillWorkspace = { attachConversation };
  });

  afterEach(() => {
    delete (window as unknown as { skillWorkspace?: unknown }).skillWorkspace;
  });

  it('ata el workspace en cuanto el chat nuevo se guarda', async () => {
    const { rerender } = renderHook(
      (props: { conversationId: string | null }) => useSkillWorkspaceLink({
        conversationId: props.conversationId,
        workspaceId: 'ws-1',
      }),
      { initialProps: { conversationId: null as string | null } },
    );

    // Mientras el chat no existe no hay nada que atar.
    expect(attachConversation).not.toHaveBeenCalled();

    // El primer mensaje crea la conversacion y llega su identificador.
    rerender({ conversationId: 'conv-nueva' });

    await waitFor(() => expect(attachConversation).toHaveBeenCalledWith('ws-1', 'conv-nueva'));
  });

  it('no le adjudica a otro chat la presentacion que quedo en pantalla', async () => {
    // Es el riesgo real de atar cualquier pareja: el usuario abre otro chat con
    // una presentacion suelta todavia visible y se la lleva ese chat.
    const { rerender } = renderHook(
      (props: { conversationId: string }) => useSkillWorkspaceLink({
        conversationId: props.conversationId,
        workspaceId: 'ws-de-otro-chat',
      }),
      { initialProps: { conversationId: 'conv-1' } },
    );

    rerender({ conversationId: 'conv-2' });

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(attachConversation).not.toHaveBeenCalled();
  });

  it('no ata nada al entrar directamente en un chat ya guardado', async () => {
    renderHook(() => useSkillWorkspaceLink({ conversationId: 'conv-1', workspaceId: 'ws-1' }));

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(attachConversation).not.toHaveBeenCalled();
  });

  it('no repite el enlace en cada render', async () => {
    const { rerender } = renderHook(
      (props: { conversationId: string | null }) => useSkillWorkspaceLink({
        conversationId: props.conversationId,
        workspaceId: 'ws-1',
      }),
      { initialProps: { conversationId: null as string | null } },
    );

    rerender({ conversationId: 'conv-1' });
    await waitFor(() => expect(attachConversation).toHaveBeenCalledTimes(1));
    rerender({ conversationId: 'conv-1' });
    rerender({ conversationId: 'conv-1' });

    expect(attachConversation).toHaveBeenCalledTimes(1);
  });

  it('sin presentacion no toca nada', async () => {
    const { rerender } = renderHook(
      (props: { conversationId: string | null }) => useSkillWorkspaceLink({
        conversationId: props.conversationId,
        workspaceId: null,
      }),
      { initialProps: { conversationId: null as string | null } },
    );

    rerender({ conversationId: 'conv-1' });

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(attachConversation).not.toHaveBeenCalled();
  });

  it('un rechazo de main no rompe el chat', async () => {
    // Main se niega a reasignar un workspace que ya pertenece a otro chat: es
    // informacion, no un fallo que deba propagarse a la interfaz.
    attachConversation.mockResolvedValue({ success: false, error: 'ya pertenece a otra conversacion' });
    const { rerender } = renderHook(
      (props: { conversationId: string | null }) => useSkillWorkspaceLink({
        conversationId: props.conversationId,
        workspaceId: 'ws-1',
      }),
      { initialProps: { conversationId: null as string | null } },
    );

    expect(() => rerender({ conversationId: 'conv-1' })).not.toThrow();

    await waitFor(() => expect(attachConversation).toHaveBeenCalled());
  });

  it('no falla fuera del escritorio, donde no existe el puente de archivos', () => {
    delete (window as unknown as { skillWorkspace?: unknown }).skillWorkspace;

    expect(() => renderHook(() => useSkillWorkspaceLink({
      conversationId: 'conv-1',
      workspaceId: 'ws-1',
    }))).not.toThrow();
  });
});
