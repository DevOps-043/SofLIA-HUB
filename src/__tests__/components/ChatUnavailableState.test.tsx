import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatUnavailableState } from '../../app/ChatUnavailableState';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

describe('Conversaciones temporalmente no disponibles', () => {
  it('espera y recupera automáticamente sin mostrar errores prematuros', async () => {
    const onRetry = vi.fn().mockResolvedValue(true);
    render(<ChatUnavailableState onRetry={onRetry} />);
    expect(screen.getByRole('status')).toHaveTextContent('Cargando conversaciones');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('heading')).toBeNull();
    await advance(500);
    await advance(20_000);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).not.toMatch(/Lia|Supabase|token|contraseñ/i);
  });

  it('agota dos intentos y permite reintentar manualmente sin datos adicionales', async () => {
    const onRetry = vi.fn().mockRejectedValueOnce(new Error('Red')).mockResolvedValue(false);
    render(<ChatUnavailableState onRetry={onRetry} />);
    await advance(2500);
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('heading')).toHaveTextContent('No pudimos cargar tus conversaciones');
    expect(screen.getByRole('alert')).toHaveTextContent(/espera un momento/i);
    await advance(60_000);
    expect(onRetry).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await advance(0);
    expect(onRetry).toHaveBeenCalledTimes(3);
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('no solapa intentos ni reinicia el presupuesto al cambiar el callback', async () => {
    let finish!: (value: boolean) => void;
    const onRetry = vi.fn(() => new Promise<boolean>(resolve => { finish = resolve; }));
    const view = render(<ChatUnavailableState onRetry={onRetry} />);
    await advance(500);
    await advance(60_000);
    expect(onRetry).toHaveBeenCalledTimes(1);
    const next = vi.fn().mockResolvedValue(false);
    view.rerender(<ChatUnavailableState onRetry={next} />);
    await act(async () => finish(false));
    await advance(2000);
    await advance(60_000);
    expect(next).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('cancelar la vista impide nuevos reintentos incluso con una respuesta tardía', async () => {
    let finish!: (value: boolean) => void;
    const onRetry = vi.fn(() => new Promise<boolean>(resolve => { finish = resolve; }));
    const view = render(<ChatUnavailableState onRetry={onRetry} />);
    await advance(500);
    view.unmount();
    await act(async () => finish(false));
    await advance(60_000);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('sin reintento disponible muestra un error legible en ambos temas', () => {
    render(<ChatUnavailableState />);
    expect(screen.getByRole('heading')).toHaveClass('text-primary');
    expect(screen.getByText(/tu sesión sigue activa/i)).toHaveClass('text-secondary');
  });
});
