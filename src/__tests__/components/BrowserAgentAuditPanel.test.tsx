import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserAgentAuditPanel } from '../../components/browser/BrowserAgentAuditPanel';
import { integratedBrowserService } from '../../services/integrated-browser-service';

vi.mock('../../services/integrated-browser-service', () => ({ integratedBrowserService: { agentAudit: vi.fn() } }));
const api = vi.mocked(integratedBrowserService.agentAudit);
const page = { total: 51, offset: 0, retentionDays: 30, entries: [{ id: '1', traceId: 'traza', tab: 'tab-hash', origin: 'https://example.com', at: 1, operation: 'type', result: 'completed', confirmation: 'none' as const }] };
beforeEach(() => { api.mockReset(); api.mockResolvedValue({ success: true, audit: page }); });
describe('bitácora visible del agente', () => {
  it('consulta explícita, pagina y muestra procedencia sin tratar operación como objetivo cumplido', async () => {
    render(<BrowserAgentAuditPanel />); expect(api).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Consultar bitácora'));
    expect(await screen.findByText('Traza: traza')).toBeInTheDocument();
    expect(screen.getByText(/Escribir · Terminada/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Siguiente'));
    await waitFor(() => expect(api).toHaveBeenLastCalledWith({ action: 'list', offset: 50 }));
  });
  it('delegación HITL sin aprobación fabricada y cancelación sin anunciar borrado', async () => {
    api.mockResolvedValueOnce({ success: true, auditChange: { cancelled: true } });
    render(<BrowserAgentAuditPanel />);
    fireEvent.click(screen.getByText('Borrar bitácora'));
    await waitFor(() => expect(screen.getByText('Borrar bitácora')).toBeEnabled());
    expect(api).toHaveBeenCalledWith({ action: 'clear' });
    expect(screen.queryByText(/Cambio confirmado/)).not.toBeInTheDocument();
    api.mockResolvedValueOnce({ success: true, auditChange: { cancelled: false } });
    fireEvent.change(screen.getByLabelText('Retención de bitácora'), { target: { value: '7' } });
    expect(await screen.findByText(/Cambio confirmado/)).toBeInTheDocument();
    expect(api).toHaveBeenLastCalledWith({ action: 'retention', days: 7 });
  });
  it('redacta errores inesperados y permite reintentar', async () => {
    api.mockRejectedValueOnce(new Error('C:/privado/token'));
    render(<BrowserAgentAuditPanel />); fireEvent.click(screen.getByText('Consultar bitácora'));
    expect(await screen.findByRole('alert')).not.toHaveTextContent('privado');
    fireEvent.click(screen.getByText('Consultar bitácora')); expect(await screen.findByText('Traza: traza')).toBeInTheDocument();
  });
  it('desmontar descarta resultados tardíos', async () => {
    let resolve!: (value: { success: boolean; audit: typeof page }) => void;
    api.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const view = render(<BrowserAgentAuditPanel />);
    fireEvent.click(screen.getByText('Consultar bitácora')); view.unmount();
    await act(async () => resolve({ success: true, audit: page }));
    expect(screen.queryByText('Traza: traza')).not.toBeInTheDocument();
  });
});
