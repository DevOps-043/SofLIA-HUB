import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserPermissionPrompt } from '../../components/browser/BrowserPermissionPrompt';
import {
  integratedBrowserService,
  type BrowserPermissionPromptRequest,
} from '../../services/integrated-browser-service';

vi.mock('../../services/integrated-browser-service', async () => {
  const actual = await vi.importActual<typeof import('../../services/integrated-browser-service')>(
    '../../services/integrated-browser-service',
  );
  return {
    ...actual,
    integratedBrowserService: {
      isAvailable: vi.fn(() => true),
      subscribe: vi.fn(() => () => {}),
      decidePermissionPrompt: vi.fn(async () => ({ success: true, resolved: true })),
    },
  };
});

const servicio = integratedBrowserService as unknown as {
  subscribe: ReturnType<typeof vi.fn>;
  decidePermissionPrompt: ReturnType<typeof vi.fn>;
};

function emitir(request: BrowserPermissionPromptRequest): void {
  const calls = servicio.subscribe.mock.calls;
  const callbacks = calls[calls.length - 1]?.[0] as {
    onPermissionPrompt?: (request: BrowserPermissionPromptRequest) => void;
  };
  callbacks?.onPermissionPrompt?.(request);
}

const aviso: BrowserPermissionPromptRequest = {
  id: 'aviso-1',
  origin: 'https://meet.google.com',
  kinds: ['microphone', 'camera'],
  labels: ['Micrófono', 'Cámara'],
};

describe('BrowserPermissionPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    servicio.subscribe.mockImplementation(() => () => {});
    servicio.decidePermissionPrompt.mockResolvedValue({ success: true, resolved: true });
  });

  it('no ocupa espacio mientras no hay nada que preguntar', () => {
    render(<BrowserPermissionPrompt />);
    expect(screen.queryByTestId('browser-permission-prompt')).toBeNull();
  });

  it('pregunta una sola vez por todos los permisos y responde al proceso principal', async () => {
    const onOpenChange = vi.fn();
    render(<BrowserPermissionPrompt onOpenChange={onOpenChange} />);

    emitir(aviso);

    // Un unico globo para camara y microfono, como en un navegador.
    const prompt = await screen.findByTestId('browser-permission-prompt');
    expect(prompt).toHaveTextContent('¿Permitir acceso a micrófono y cámara?');
    expect(prompt).toHaveTextContent('https://meet.google.com');
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(true));

    await userEvent.click(screen.getByRole('button', { name: 'Permitir' }));

    expect(servicio.decidePermissionPrompt).toHaveBeenCalledWith({ id: 'aviso-1', granted: true });
    await waitFor(() => expect(screen.queryByTestId('browser-permission-prompt')).toBeNull());
    await waitFor(() => expect(onOpenChange).toHaveBeenLastCalledWith(false));
  });

  it('deniega al bloquear y encola los avisos que llegan mientras hay uno abierto', async () => {
    render(<BrowserPermissionPrompt />);

    emitir(aviso);
    emitir({ id: 'aviso-2', origin: 'https://otro.example', kinds: ['camera'], labels: ['Cámara'] });

    // El segundo espera turno: dos globos a la vez dejarian al usuario sin
    // saber a que sitio responde.
    const prompt = await screen.findByTestId('browser-permission-prompt');
    expect(prompt).toHaveTextContent('https://meet.google.com');
    expect(screen.queryByText('https://otro.example')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Bloquear' }));

    expect(servicio.decidePermissionPrompt).toHaveBeenCalledWith({ id: 'aviso-1', granted: false });
    await waitFor(() => expect(screen.getByTestId('browser-permission-prompt')).toHaveTextContent('https://otro.example'));
  });
});
