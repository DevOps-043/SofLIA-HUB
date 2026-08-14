import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { WhatsAppPassiveSkillsCard } from '../../components/whatsapp-setup/WhatsAppPassiveSkillsCard';

describe('WhatsAppPassiveSkillsCard', () => {
  it('creates one-shot flows with date and time', async () => {
    const saveRule = vi.fn(async () => ({ success: true }));
    Object.defineProperty(window, 'passiveSkills', {
      value: {
        getOverview: vi.fn(async () => ({ success: true, overview: { rules: [], systemRules: [] } })),
        saveRule,
        deleteRule: vi.fn(async () => ({ success: true, deleted: true })),
      },
      configurable: true,
    });

    const { container } = render(<WhatsAppPassiveSkillsCard selectedTarget="contact:5215500000000" />);
    fireEvent.change(screen.getByPlaceholderText('Nombre de la skill pasiva'), {
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
    fireEvent.click(screen.getByText('Crear skill pasiva'));

    await waitFor(() => expect(saveRule).toHaveBeenCalledWith(expect.objectContaining({
      cronExpression: '30 9 28 5 *',
      scheduleLabel: 'El 28/05/2099 a las 09:30',
      runOnce: true,
      scheduledFor: '2099-05-28T09:30:00',
      phoneNumber: '5215500000000',
    })));
  });
});
