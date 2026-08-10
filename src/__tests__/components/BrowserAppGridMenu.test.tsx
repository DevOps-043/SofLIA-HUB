import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserAppGridMenu, computeRecurrentSites } from '../../components/browser/BrowserAppGridMenu';
import type { BrowserHistoryEntry } from '../../services/integrated-browser-service';

describe('BrowserAppGridMenu', () => {
  it('renderiza el botón del menú de aplicaciones de la Rejilla (3x3)', () => {
    render(
      <BrowserAppGridMenu
        open={false}
        onOpenChange={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );

    const button = screen.getByRole('button', { name: 'Herramientas del Ecosistema SofLIA' });
    expect(button).toBeInTheDocument();
  });

  it('muestra las herramientas por defecto del Ecosistema SofLIA al desplegarse', () => {
    render(
      <BrowserAppGridMenu
        open={true}
        onOpenChange={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );

    expect(screen.getByText('Ecosistema SofLIA')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /SOFLIA LEARNING/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /SofLIA Engine/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Project Hub/i })).toBeInTheDocument();
  });

  it('navega a la URL seleccionada y cierra el menú al hacer clic en una aplicación', () => {
    const onNavigate = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <BrowserAppGridMenu
        open={true}
        onOpenChange={onOpenChange}
        onNavigate={onNavigate}
      />,
    );

    const appButton = screen.getByRole('menuitem', { name: /SOFLIA LEARNING/i });
    fireEvent.click(appButton);

    expect(onNavigate).toHaveBeenCalledWith('https://soflia.ai');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('calcula y prioriza los sitios más recurrentes según la frecuencia de visitas en el historial', () => {
    const history: BrowserHistoryEntry[] = [
      { id: '1', url: 'https://chatgpt.com/c/1', title: 'ChatGPT', visitedAt: '2026-08-10T12:00:00.000Z' },
      { id: '2', url: 'https://chatgpt.com/c/2', title: 'ChatGPT', visitedAt: '2026-08-10T12:10:00.000Z' },
      { id: '3', url: 'https://www.youtube.com/watch?v=abc', title: 'YouTube video', visitedAt: '2026-08-10T12:15:00.000Z' },
      { id: '4', url: 'https://www.youtube.com/watch?v=def', title: 'YouTube video 2', visitedAt: '2026-08-10T12:20:00.000Z' },
      { id: '5', url: 'https://www.youtube.com/watch?v=ghi', title: 'YouTube video 3', visitedAt: '2026-08-10T12:25:00.000Z' },
    ];

    const recurrent = computeRecurrentSites(history, []);
    expect(recurrent.length).toBeGreaterThan(0);
    expect(recurrent[0].domain).toBe('youtube.com');
    expect(recurrent[0].title).toBe('YouTube');
    expect(recurrent[1].domain).toBe('chatgpt.com');
    expect(recurrent[1].title).toBe('ChatGPT');
  });
});
