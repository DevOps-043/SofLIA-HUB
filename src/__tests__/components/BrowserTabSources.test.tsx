import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TabAttachmentPicker } from '../../adapters/desktop_ui/chat-ui/input/TabAttachmentPicker';
import { SourceLinks } from '../../adapters/desktop_ui/chat-ui/messages/SourceLinks';
import { integratedBrowserService } from '../../services/integrated-browser-service';

vi.mock('../../services/integrated-browser-service', () => ({ integratedBrowserService: { isAvailable: vi.fn(() => true), getTabSummaries: vi.fn() } }));
const summaries = [
  { tabId: '1', url: 'https://uno.example/', title: 'Presupuesto', text: '', isCurrent: true, documentToken: 'a'.repeat(36) },
  { tabId: '2', url: 'https://dos.example/', title: 'Contrato', text: '', isCurrent: false, documentToken: 'b'.repeat(36) },
  { tabId: '3', url: 'about:blank', title: 'Nueva pestaña', text: '', isCurrent: false },
];
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(integratedBrowserService.getTabSummaries).mockResolvedValue({ success: true, summaries, state: { profileRevision: 7 } } as Awaited<ReturnType<typeof integratedBrowserService.getTabSummaries>>);
});
describe('Selector y evidencia de pestañas', () => {
  it('distingue citas ausentes e inventadas de evidencia suministrada', () => {
    const source = { kind: 'browser' as const, citationId: 'P1:F1', title: 'Contrato', uri: 'https://example.com/', snippet: 'Extracto real', capturedAt: '2026-09-09T12:00:00Z' };
    const { rerender } = render(<SourceLinks sources={[source]} responseText="Conclusión sin cita" />);
    expect(screen.getByRole('status')).toHaveTextContent('no señaló citas');
    rerender(<SourceLinks sources={[source]} responseText="Conclusión [P9:F1]" />);
    expect(screen.getByRole('alert')).toHaveTextContent('P9:F1');
    rerender(<SourceLinks sources={[source]} responseText="Conclusión [P1:F1]" />);
    expect(screen.queryByRole('alert')).toBeNull(); expect(screen.queryByRole('status')).toBeNull();
  });
  it('busca por título o sitio y adjunta el recibo de la selección sin leer DOM', async () => {
    const toggle = vi.fn();
    const { container } = render(<TabAttachmentPicker attachedTabs={[]} onToggleTab={toggle} onClose={vi.fn()} />);
    await screen.findByRole('button', { name: /Presupuesto/ });
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'dos.example' } });
    expect(screen.queryByRole('button', { name: /Presupuesto/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Contrato/ }));
    expect(toggle).toHaveBeenCalledWith({ ...summaries[1], expected: { profileRevision: 7, documentToken: 'b'.repeat(36) } });
    expect(container.querySelectorAll('img')).toHaveLength(0);
  });
  it('no adjunta páginas internas y permite desmarcar al llegar al límite', async () => {
    render(<TabAttachmentPicker attachedTabs={Array.from({ length: 8 }, (_, index) => ({ ...summaries[0], tabId: `${index + 1}` }))} onToggleTab={vi.fn()} onClose={vi.fn()} />);
    expect(await screen.findByRole('button', { name: /Nueva pestaña/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Presupuesto/ })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /Presupuesto/ })).toHaveAttribute('aria-pressed', 'true');
  });
  it('reintenta un listado fallido y Escape cierra sin adjuntar', async () => {
    vi.mocked(integratedBrowserService.getTabSummaries).mockRejectedValueOnce(new Error('No mostrar ruta ni token'));
    const close = vi.fn(); const toggle = vi.fn();
    render(<TabAttachmentPicker attachedTabs={[]} onToggleTab={toggle} onClose={close} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
    await screen.findByRole('button', { name: /Contrato/ });
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' });
    expect(close).toHaveBeenCalledTimes(1); expect(toggle).not.toHaveBeenCalled();
    expect(screen.queryByText(/ruta ni token/)).toBeNull();
  });
  it('no publica un listado que llega después de desmontar', async () => {
    let finish!: (value: unknown) => void;
    vi.mocked(integratedBrowserService.getTabSummaries).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve as typeof finish; }));
    const { unmount } = render(<TabAttachmentPicker attachedTabs={[]} onToggleTab={vi.fn()} onClose={vi.fn()} />);
    unmount(); await act(async () => { finish({ success: true, summaries, state: { profileRevision: 7 } }); });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('muestra extractos citados sin ejecutar HTML ni solicitar iconos externos', () => {
    const { container } = render(<SourceLinks sources={[
      { kind: 'browser', citationId: 'P1:F1', title: 'Contrato', uri: 'https://example.com/p?token=privado', snippet: '<img src="https://ajeno.example/">', capturedAt: '2026-09-09T12:00:00Z' },
      { uri: 'javascript:alert(1)', title: 'No permitido' },
      { uri: 'https://web.example/search?q=consulta', title: 'Consulta web' },
    ]} />);
    expect(screen.getByText('[P1:F1] Contrato')).toBeInTheDocument();
    expect(screen.getByText('<img src="https://ajeno.example/">')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Abrir sitio/ })).toHaveAttribute('href', 'https://example.com/p');
    expect(screen.getByRole('link', { name: 'Consulta web' })).toHaveAttribute('href', 'https://web.example/search?q=consulta');
    expect(screen.queryByRole('link', { name: 'No permitido' })).toBeNull();
    expect(container.querySelectorAll('img')).toHaveLength(0);
  });
});
