import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ConfirmActionModalProps } from '../../components/ConfirmActionModal';
import { ChatModals } from '../../adapters/desktop_ui/chat-ui/ChatModals';
import type { ChatUIController } from '../../adapters/desktop_ui/chat-ui/useChatUIController';
import type { ConfirmationModalState } from '../../adapters/desktop_ui/chat-ui/types';

const captured = vi.hoisted(() => ({ current: null as ConfirmActionModalProps | null }));
vi.mock('../../components/ConfirmActionModal', () => ({ ConfirmActionModal: (props: ConfirmActionModalProps) => { captured.current = props; return null; } }));
vi.mock('../../components/skills-settings/SkillEditorModal', () => ({ SkillEditorModal: () => null }));
vi.mock('../../components/SkillLibrary', () => ({ SkillLibrary: () => null }));
vi.mock('../../adapters/desktop_ui/chat-ui/ImageZoomModal', () => ({ ImageZoomModal: () => null }));
function fixture(modal: ConfirmationModalState | null) {
  const setModal = vi.fn();
  const controller = { state: { skillModals: {}, confirmation: { modal, setModal }, images: { zoomed: null, setZoomed: vi.fn() } }, tools: {} } as unknown as ChatUIController;
  return { controller, setModal };
}
let sequence = 0;
const request = (): ConfirmationModalState => ({ requestId: ++sequence, toolName: 'execute_command', description: 'Comando ficticio', allowAlways: true, resolve: vi.fn() });

describe('propiedad de la confirmación presentada por ChatModals', () => {
  it.each(['confirm', 'always', 'cancel'] as const)('delega %s al dueño sin limpiar por su cuenta', action => {
    const modal = request(), f = fixture(modal); render(<ChatModals controller={f.controller} />);
    expect(captured.current?.requestId).toBe(modal.requestId);
    if (action === 'confirm') captured.current!.onConfirm();
    else if (action === 'always') captured.current!.onAlways!();
    else captured.current!.onCancel();
    expect(modal.resolve).toHaveBeenCalledWith(action === 'always' ? 'always' : action === 'confirm');
    expect(f.setModal).not.toHaveBeenCalled();
  });

  it('un callback de la solicitud previa no retira la nueva', () => {
    const old = request(), current = request(), f = fixture(old);
    const view = render(<ChatModals controller={f.controller} />), previous = captured.current!;
    f.controller.state.confirmation.modal = current; view.rerender(<ChatModals controller={f.controller} />);
    previous.onCancel();
    expect(old.resolve).toHaveBeenCalledWith(false); expect(current.resolve).not.toHaveBeenCalled();
    expect(f.setModal).not.toHaveBeenCalled(); expect(captured.current?.requestId).toBe(current.requestId);
    expect(f.controller.state.confirmation.modal).toBe(current);
  });

  it('respeta la ausencia de permiso permanente y de solicitud', () => {
    const modal = { ...request(), allowAlways: false }, f = fixture(modal);
    const view = render(<ChatModals controller={f.controller} />); expect(captured.current?.onAlways).toBeUndefined();
    f.controller.state.confirmation.modal = null; view.rerender(<ChatModals controller={f.controller} />);
    expect(captured.current?.isOpen).toBe(false); expect(f.setModal).not.toHaveBeenCalled();
  });
});
