import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ToolsDropdownButton } from '../../adapters/desktop_ui/chat-ui/header/ToolsDropdownButton';

describe('ToolsDropdownButton component', () => {
  it('UI-002: abre el menu desplegable Abrir en y llama los callbacks de herramientas', () => {
    const onOpenBrowser = vi.fn();
    const onOpenMeetings = vi.fn();
    const onOpenSdo = vi.fn();

    render(
      <ToolsDropdownButton
        onOpenBrowser={onOpenBrowser}
        onOpenMeetings={onOpenMeetings}
        onOpenSdo={onOpenSdo}
      />
    );

    const button = screen.getByTitle('Herramientas (Navegador, Reuniones, Registro de decisiones)');
    expect(button).toBeInTheDocument();

    fireEvent.click(button);

    const browserOption = screen.getByText('Navegador');
    fireEvent.click(browserOption);
    expect(onOpenBrowser).toHaveBeenCalledTimes(1);
  });
});
