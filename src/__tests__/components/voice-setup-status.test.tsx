import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RuntimeStatusCard } from '../../components/voice-settings/RuntimeStatusCard';
import { VoiceModelCard } from '../../components/voice-settings/VoiceModelCard';
import type { VoicePassivePanel } from '../../components/voice-settings/useVoicePassivePanel';

function panel(state: string, blocked = false) {
  return { status: { setupState: state, runtimeAvailable: false, setupErrorCode: blocked ? 'voice_runtime_blocked' : undefined },
    modelInstalled: false, busy: false, installModel: vi.fn() } as unknown as VoicePassivePanel;
}
describe('Preparación de voz en Ajustes', () => {
  it('muestra preparación automática sin comandos ni instalación manual del modelo básico', () => {
    const value = panel('runtime');
    const { container } = render(<><RuntimeStatusCard panel={value} /><VoiceModelCard panel={value} /></>);
    expect(screen.getByText('Instalando automáticamente…')).toBeInTheDocument();
    expect(container.textContent).not.toContain('npm');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
  it('permite reintentar un fallo sin requerir terminal', () => {
    render(<RuntimeStatusCard panel={panel('error')} />);
    expect(screen.getByRole('button', { name: 'Reintentar preparación' })).toBeInTheDocument();
  });
  it('explica el bloqueo de Windows sin atribuirlo a la red', () => {
    render(<RuntimeStatusCard panel={panel('error', true)} />);
    expect(screen.getByText(/Windows ha bloqueado/)).toBeInTheDocument();
  });
});
