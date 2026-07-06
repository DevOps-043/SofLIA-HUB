import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConnectionsPanel } from '../../components/ConnectionsPanel';

vi.mock('../../components/connections-panel/useTelegramConnection', () => ({
  useTelegramConnection: () => ({
    status: null,
    tokenInput: '',
    testing: false,
    error: null,
    connected: false,
    setTokenInput: vi.fn(),
    saveToken: vi.fn(),
    disconnect: vi.fn(),
    toggle: vi.fn(),
  }),
}));

vi.mock('../../components/connections-panel/useWhatsAppConnection', () => ({
  useWhatsAppConnection: () => ({
    status: {
      connected: false,
      phoneNumber: null,
      qr: null,
    },
    connecting: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
  }),
}));

vi.mock('../../components/connections-panel/useCalendarConnections', () => ({
  useCalendarConnections: () => ({
    google: undefined,
    microsoft: undefined,
    loading: null,
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
  }),
}));

describe('ConnectionsPanel', () => {
  it('muestra solo conexiones de canales y proveedores externos soportados', () => {
    render(<ConnectionsPanel />);

    expect(screen.getByText('WhatsApp')).toBeInTheDocument();
    expect(screen.getByText('Telegram')).toBeInTheDocument();
    expect(screen.getByText('Google Workspace')).toBeInTheDocument();
    expect(screen.queryByText('SofLIA Learning')).not.toBeInTheDocument();
    expect(screen.queryByText('Receptor HTTP')).not.toBeInTheDocument();
  });
});
