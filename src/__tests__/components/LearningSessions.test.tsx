import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LearningSessions } from '../../components/learning-live/LearningSessions';
import { ToolsDropdownButton } from '../../adapters/desktop_ui/chat-ui/header/ToolsDropdownButton';
import type { LiveCatalogResult } from '../../shared/learning-live-catalog';
const mocks = vi.hoisted(() => ({ catalog: vi.fn() }));
vi.mock('../../services/learning-live-service', () => ({ learningLiveService: mocks }));
const session = { id: '00000000-0000-4000-8000-000000000031', title: 'Mi próxima clase', description: '', starts_at: '2026-10-11T18:00:00Z', duration_minutes: 60, status: 'live' as const, session_type: 'meeting' as const, course_title: 'IA aplicada', instructor_name: 'Mariana' };
const catalog = { version: 1 as const, user_id: '00000000-0000-4000-8000-000000000013', can_teach: false, total: 1, sessions: [session] };
beforeEach(() => { vi.clearAllMocks(); mocks.catalog.mockResolvedValue({ success: true, catalog }); });
describe('agenda de sesiones síncronas', () => {
  it('añade el acceso debajo de Navegador y Reuniones y cierra el menú al abrir', () => {
    const open = vi.fn(); render(<ToolsDropdownButton onOpenBrowser={vi.fn()} onOpenMeetings={vi.fn()} onOpenLiveSessions={open} />);
    fireEvent.click(screen.getByLabelText('Abrir menú de herramientas'));
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['NavegadorCtrl+T', 'ReunionesCtrl+M', 'Sesiones síncronas']);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sesiones síncronas' })); expect(open).toHaveBeenCalledOnce(); expect(screen.queryByRole('menu')).toBeNull();
  });
  it('consulta la organización activa y abre el aula por referencia sin abrir medios', async () => {
    const select = vi.fn(); render(<LearningSessions organizationSlug="acme" onSelect={select} onClose={vi.fn()} />);
    await screen.findByText(session.title); expect(select).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Unirme a la sesión' }));
    expect(select).toHaveBeenCalledWith({ organization_slug: 'acme', session_id: session.id });
    expect(mocks.catalog).toHaveBeenCalledWith({ organization_slug: 'acme', page: 0, view: 'student' });
  });
  it('muestra error recuperable y vacío, sin confundirlos', async () => {
    mocks.catalog.mockResolvedValueOnce({ success: false, error: 'Learning sin conexión' }).mockResolvedValueOnce({ success: true, catalog: { ...catalog, total: 0, sessions: [] } });
    render(<LearningSessions organizationSlug="acme" onSelect={vi.fn()} onClose={vi.fn()} />);
    await screen.findByText('Learning sin conexión'); fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await screen.findByText('Tu agenda está despejada'); expect(screen.queryByRole('alert')).toBeNull();
  });
  it('pagina sin duplicar los resultados de la primera página', async () => {
    mocks.catalog.mockResolvedValueOnce({ success: true, catalog: { ...catalog, total: 21 } }).mockResolvedValueOnce({ success: true, catalog: { ...catalog, total: 21, sessions: [{ ...session, id: '00000000-0000-4000-8000-000000000032', title: 'Última clase' }] } });
    render(<LearningSessions organizationSlug="acme" onSelect={vi.fn()} onClose={vi.fn()} />);
    await screen.findByText(session.title); fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await screen.findByText('Última clase'); expect(screen.queryByText(session.title)).toBeNull();
    expect(mocks.catalog).toHaveBeenLastCalledWith({ organization_slug: 'acme', page: 1, view: 'student' });
  });
  it('descarta una respuesta tardía de la organización anterior', async () => {
    let resolve!: (value: LiveCatalogResult) => void;
    mocks.catalog.mockReturnValueOnce(new Promise<LiveCatalogResult>((done) => { resolve = done; })).mockResolvedValueOnce({ success: true, catalog: { ...catalog, total: 0, sessions: [] } });
    const view = render(<LearningSessions organizationSlug="acme" onSelect={vi.fn()} onClose={vi.fn()} />);
    view.rerender(<LearningSessions organizationSlug="otra" onSelect={vi.fn()} onClose={vi.fn()} />);
    await screen.findByText('Tu agenda está despejada'); await act(async () => resolve({ success: true, catalog }));
    expect(screen.queryByText(session.title)).toBeNull();
    await waitFor(() => expect(mocks.catalog).toHaveBeenCalledTimes(2));
  });
});
