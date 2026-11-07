import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RemoteNodesPanel } from '../../components/ops/automation-ops-panel/RemoteNodesPanel';
import type { AutomationOpsController } from '../../components/ops/automation-ops-panel/useAutomationOpsController';
afterEach(cleanup);
const controller = (notice?: string) => ({
  forms: { remoteNode: { name: '', baseUrl: '', token: 'token-manual-ficticio', setName: vi.fn(), setBaseUrl: vi.fn(), setToken: vi.fn() } },
  data: { hostStatus: { running: false, enabled: false, token: 'token-host-ficticio', migration_notice: notice }, nodes: [] },
  runner: { actionKey: null, runAction: vi.fn(), setNotice: vi.fn() },
} as unknown as AutomationOpsController);
describe('Panel de nodos y migración privada', () => {
  it('muestra el aviso público de emparejamiento sin publicar tokens como texto', () => {
    render(<RemoteNodesPanel controller={controller('La configuración anterior está preservada cifrada. Vuelve a emparejar los nodos pendientes.')} />);
    expect(screen.getByRole('status').textContent).toContain('preservada cifrada');
    expect(screen.queryByText('token-host-ficticio')).toBeNull();
    expect(screen.getByPlaceholderText('Token').getAttribute('type')).toBe('password');
    const hostToken = screen.getByLabelText('Token de este equipo') as HTMLInputElement;
    expect(hostToken.type).toBe('password'); expect(hostToken.readOnly).toBe(true);
    fireEvent.focus(hostToken); expect(hostToken.selectionStart).toBe(0); expect(hostToken.selectionEnd).toBe(hostToken.value.length);
  });
  it('no inventa aviso cuando el perfil no tiene migración pendiente', () => {
    render(<RemoteNodesPanel controller={controller()} />); expect(screen.queryByRole('status')).toBeNull();
  });
});
