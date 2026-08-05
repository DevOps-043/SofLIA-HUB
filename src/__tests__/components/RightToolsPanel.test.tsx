import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { RightToolsPanel } from '../../components/RightToolsPanel';

describe('RightToolsPanel component', () => {
  it('UI-002: abre el navegador integrado desde el panel de herramientas derecho', () => {
    const onOpenBrowser = vi.fn();
    render(<RightToolsPanel activeView="chat" onOpenBrowser={onOpenBrowser} />);
    fireEvent.click(screen.getByText('Navegador'));
    expect(onOpenBrowser).toHaveBeenCalledTimes(1);
  });

  it('UI-003: ejecuta las vistas de reuniones y decisiones', () => {
    const onOpenMeetings = vi.fn();
    const onOpenSdo = vi.fn();
    render(<RightToolsPanel activeView="chat" onOpenMeetings={onOpenMeetings} onOpenSdo={onOpenSdo} />);
    
    fireEvent.click(screen.getByText('Reuniones'));
    expect(onOpenMeetings).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Registro de decisiones'));
    expect(onOpenSdo).toHaveBeenCalledTimes(1);
  });
});
