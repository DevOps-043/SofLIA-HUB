import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserWorkspaceLayout } from '../../components/browser/BrowserWorkspaceLayout';

vi.mock('../../components/browser/IntegratedBrowserPanel', () => ({
  IntegratedBrowserPanel: (props: { maximized?: boolean; onToggleMaximize?: () => void }) => (
    <div>
      <span>{props.maximized ? 'Navegador completo' : 'Navegador lateral'}</span>
      <button onClick={props.onToggleMaximize}>Cambiar tamano</button>
    </div>
  ),
}));

describe('BrowserWorkspaceLayout', () => {
  it('muestra el chat a la izquierda y permite que el navegador cubra todo', () => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      disconnect() {}
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, right: 1200, bottom: 800,
      width: 1200, height: 800, toJSON: () => ({}),
    });
    render(<BrowserWorkspaceLayout chat={<div>Chat activo con SofLIA</div>} onClose={vi.fn()} />);

    expect(screen.getByText('Chat activo con SofLIA')).toBeInTheDocument();
    expect(screen.getByRole('separator', { name: 'Ajustar ancho del navegador' })).toBeInTheDocument();
    fireEvent.click(screen.getByText('Cambiar tamano'));
    expect(screen.queryByText('Chat activo con SofLIA')).not.toBeInTheDocument();
    expect(screen.getByText('Navegador completo')).toBeInTheDocument();
  });
});
