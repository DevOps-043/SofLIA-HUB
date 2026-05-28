import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { WhatsAppFlowsCard } from '../../components/whatsapp-setup/WhatsAppFlowsCard';

describe('WhatsAppFlowsCard', () => {
  it('creates one-shot flows with date and time', async () => {
    const savePassiveRule = vi.fn(async () => ({ success: true }));
    Object.defineProperty(window, 'workflowHub', {
      value: {
        getOverview: vi.fn(async () => ({ success: true, overview: { passiveRules: [] } })),
        savePassiveRule,
        deletePassiveRule: vi.fn(async () => ({ success: true, deleted: true })),
      },
      configurable: true,
    });

    const { container } = render(<WhatsAppFlowsCard selectedTarget="contact:5215500000000" />);
    fireEvent.change(screen.getByPlaceholderText('Nombre del flujo'), {
      target: { value: 'Noticias IA' },
    });
    fireEvent.change(container.querySelector('input[type="date"]') as HTMLInputElement, {
      target: { value: '2099-05-28' },
    });
    fireEvent.change(screen.getByDisplayValue('09:00'), {
      target: { value: '09:30' },
    });
    fireEvent.change(screen.getByPlaceholderText('Instruccion que se ejecutara cuando se dispare'), {
      target: { value: 'Dame noticias relevantes de IA.' },
    });
    fireEvent.click(screen.getByText('Crear flujo'));

    await waitFor(() => expect(savePassiveRule).toHaveBeenCalledWith(expect.objectContaining({
      cronExpression: '30 9 28 5 *',
      scheduleLabel: 'El 28/05/2099 a las 09:30',
      runOnce: true,
      scheduledFor: '2099-05-28T09:30:00',
      phoneNumber: '5215500000000',
    })));
  });
});
