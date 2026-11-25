import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ToolMenu } from '../../adapters/desktop_ui/chat-ui/input/ToolMenu';
import type { ChatUIController } from '../../adapters/desktop_ui/chat-ui/useChatUIController';
import type { ComputerPermissionMode } from '../../shared/computer-permissions';
import * as permissions from '../../services/computer-use/permissions';

function ComposerMenu() {
  const [isOpen, setOpen] = useState(false);
  const controller = { props: { canSendMessages: true }, state: { modes: {}, tools: { isOpen, setOpen } } } as ChatUIController;
  return <ToolMenu controller={controller} />;
}

it('muestra y cambia los permisos desde el menú + al confirmar la respuesta de main', async () => {
  const available = vi.spyOn(permissions, 'hasComputerPermissions').mockReturnValue(true);
  const permissionMode = vi.spyOn(permissions, 'computerPermissionMode')
    .mockImplementation(async (mode: ComputerPermissionMode = 'review') => ({ success: true, mode }));
  try {
    render(<ComposerMenu />);
    fireEvent.click(screen.getByRole('button', { name: 'Más opciones' }));
    fireEvent.click(screen.getByRole('button', { name: /Permisos de computadora/ }));
    const ask = screen.getByRole('button', { name: /Aprobar por mí/ });
    const full = screen.getByRole('button', { name: /Acceso completo/ });
    await waitFor(() => expect(ask).toHaveAttribute('aria-pressed', 'true'));
    fireEvent.click(full);
    await waitFor(() => expect(full).toHaveAttribute('aria-pressed', 'true'));
    expect(permissionMode).toHaveBeenCalledWith('full');
    fireEvent.click(ask);
    await waitFor(() => expect(ask).toHaveAttribute('aria-pressed', 'true'));
  } finally { available.mockRestore(); permissionMode.mockRestore(); }
});
