import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChatUnavailableState } from '../../app/ChatUnavailableState';

describe('Conversaciones temporalmente no disponibles', () => {
  it('UI-068: usa lenguaje simple y no expone autenticacion interna', () => {
    render(<ChatUnavailableState onRetry={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'No pudimos cargar tus conversaciones' })).toBeInTheDocument();
    expect(screen.getByText(/tu sesi[oó]n sigue activa/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Lia|Supabase|credencial|contraseñ|base de datos/i);
  });

  it('UI-069: permite reintentar sin solicitar datos adicionales', async () => {
    const onRetry = vi.fn().mockResolvedValue(true);
    render(<ChatUnavailableState onRetry={onRetry} />);

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(onRetry).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('UI-070: un reintento fallido conserva un mensaje accionable no tecnico', async () => {
    render(<ChatUnavailableState onRetry={vi.fn().mockResolvedValue(false)} />);

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/espera un momento/i);
    expect(document.body.textContent).not.toMatch(/Lia|Supabase|token|contraseñ/i);
  });
});
