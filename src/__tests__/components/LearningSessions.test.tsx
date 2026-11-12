import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { managementPageUrl } from '../../components/learning-live/agenda-model';
import { LearningSessions } from '../../components/learning-live/LearningSessions';
import { ToolsDropdownButton } from '../../adapters/desktop_ui/chat-ui/header/ToolsDropdownButton';
import type { LiveCatalogResult } from '../../shared/learning-live-catalog';
const mocks = vi.hoisted(() => ({ catalog: vi.fn() }));
vi.mock('../../services/learning-live-service', () => ({ learningLiveService: mocks }));
const session = { id: '00000000-0000-4000-8000-000000000031', title: 'Mi próxima clase', description: '', starts_at: '2026-11-11T18:00:00Z', duration_minutes: 60, status: 'live' as const, session_type: 'meeting' as const, course_title: 'IA aplicada', instructor_name: 'Mariana' };
const catalog = { version: 1 as const, user_id: '00000000-0000-4000-8000-000000000013', can_teach: false, total: 1, sessions: [session] };
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-11T17:00:00Z')); vi.clearAllMocks(); mocks.catalog.mockResolvedValue({ success: true, catalog }); });
afterEach(() => { vi.useRealTimers(); });

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

const managerCatalog = {
  ...catalog, can_teach: true,
  capabilities: { version: 1 as const, role: 'organization_admin' as const, can_manage: true, can_view_history: true },
  management_url: 'https://learning.test/acme/instructor',
};

describe('agenda según permisos confirmados', () => {
  it('el alumno no recibe controles de historial ni gestión aunque una etiqueta diga administrador', async () => {
    mocks.catalog.mockResolvedValue({ success: true, catalog: { ...managerCatalog, can_teach: false } });
    render(<LearningSessions organizationSlug="acme" onSelect={vi.fn()} onClose={vi.fn()} onOpenManagement={vi.fn()} />);
    await screen.findByText(session.title);
    expect(screen.queryByRole('button', { name: 'Historial' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Organización' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Gestionar en Learning' })).toBeNull();
  });

  it.each(['platform_admin', 'organization_admin', 'instructor'] as const)('adapta la navegación de %s sin enviar un rol al servidor', async (role) => {
    mocks.catalog.mockResolvedValue({ success: true, catalog: { ...managerCatalog, capabilities: { ...managerCatalog.capabilities, role } } });
    render(<LearningSessions organizationSlug="acme" onSelect={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: role === 'instructor' ? 'Clases que imparto' : 'Organización' }));
    await waitFor(() => expect(mocks.catalog).toHaveBeenLastCalledWith({ organization_slug: 'acme', page: 0, view: 'instructor' }));
  });

  it('consulta el historial autorizado y abre detalles por una ruta conocida sin entrar al aula', async () => {
    const past = { ...session, title: 'Clase anterior', starts_at: '2026-10-01T18:00:00Z', status: 'ended' };
    mocks.catalog.mockResolvedValueOnce({ success: true, catalog: managerCatalog }).mockResolvedValueOnce({ success: true, catalog: { ...managerCatalog, sessions: [past] } });
    const open = vi.fn().mockResolvedValue(undefined); const select = vi.fn();
    render(<LearningSessions organizationSlug="acme" onSelect={select} onClose={vi.fn()} onOpenManagement={open} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Historial' }));
    await screen.findByText('Clase anterior');
    expect(mocks.catalog).toHaveBeenLastCalledWith({ organization_slug: 'acme', page: 0, view: 'instructor', period: 'past' });
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalles: Clase anterior' }));
    expect(open).toHaveBeenCalledWith(`https://learning.test/acme/live/${session.id}`);
    expect(select).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Unirme a la sesión' })).toBeNull();
  });

  it('abre gestión existente y muestra un fallo de navegación sin perder agenda', async () => {
    mocks.catalog.mockResolvedValue({ success: true, catalog: managerCatalog });
    const open = vi.fn().mockRejectedValue(new Error('Fallo del navegador'));
    render(<LearningSessions organizationSlug="acme" onSelect={vi.fn()} onClose={vi.fn()} onOpenManagement={open} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Gestionar en Learning' }));
    expect(open).toHaveBeenCalledWith('https://learning.test/acme/instructor');
    await screen.findByRole('alert'); expect(screen.getByText(session.title)).toBeInTheDocument();
  });

  it('no ofrece gestión web ni historial cuando Learning no negocia capacidades', async () => {
    mocks.catalog.mockResolvedValue({ success: true, catalog: { ...catalog, can_teach: true } });
    render(<LearningSessions organizationSlug="acme" onSelect={vi.fn()} onClose={vi.fn()} onOpenManagement={vi.fn()} />);
    await screen.findByRole('button', { name: 'Clases que imparto' });
    expect(screen.queryByRole('button', { name: 'Historial' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Gestionar en Learning' })).toBeNull();
  });

  it('excluye sesiones vencidas y estados finalizados de próximas aunque el servidor sea anterior', async () => {
    mocks.catalog.mockResolvedValue({ success: true, catalog: { ...catalog, total: 3, sessions: [session, { ...session, id: 'old', title: 'Vencida', status: 'scheduled', starts_at: '2026-10-11T18:00:00Z' }, { ...session, id: 'ended', title: 'Finalizada futura', status: 'ended' }] } });
    render(<LearningSessions organizationSlug="acme" onSelect={vi.fn()} onClose={vi.fn()} />);
    await screen.findByText(session.title);
    expect(screen.queryByText('Vencida')).toBeNull(); expect(screen.queryByText('Finalizada futura')).toBeNull();
    expect(screen.queryByText('3 sesiones')).toBeNull();
  });

  it('reinicia la vista de gestión y la página al cambiar organización', async () => {
    mocks.catalog.mockResolvedValue({ success: true, catalog: { ...managerCatalog, total: 21 } });
    const view = render(<LearningSessions organizationSlug="acme" onSelect={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Organización' }));
    await waitFor(() => expect(mocks.catalog).toHaveBeenLastCalledWith({ organization_slug: 'acme', page: 0, view: 'instructor' }));
    view.rerender(<LearningSessions organizationSlug="otra" onSelect={vi.fn()} onClose={vi.fn()} />);
    await waitFor(() => expect(mocks.catalog).toHaveBeenLastCalledWith({ organization_slug: 'otra', page: 0, view: 'student' }));
  });

  it('retira gestión al revocarse el permiso durante la consulta', async () => {
    mocks.catalog.mockResolvedValueOnce({ success: true, catalog: managerCatalog })
      .mockResolvedValueOnce({ success: true, catalog: { ...managerCatalog, capabilities: { ...managerCatalog.capabilities, can_manage: false, can_view_history: false }, sessions: [{ ...session, title: 'No debe verse' }] } })
      .mockResolvedValue({ success: true, catalog });
    render(<LearningSessions organizationSlug="acme" onSelect={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Organización' }));
    await waitFor(() => expect(mocks.catalog).toHaveBeenLastCalledWith({ organization_slug: 'acme', page: 0, view: 'student' }));
    expect(screen.queryByText('No debe verse')).toBeNull();
  });
});


it('rechaza rutas de gestión de otra organización o con credenciales y no acepta sesiones ajenas', () => {
  expect(managementPageUrl(managerCatalog, 'otra')).toBeNull();
  expect(managementPageUrl({ ...managerCatalog, management_url: 'https://actor:clave@learning.test/acme/instructor' }, 'acme')).toBeNull();
  expect(managementPageUrl({ ...managerCatalog, management_url: 'https://learning.test/acme/instructor?token=privado' }, 'acme')).toBeNull();
  expect(managementPageUrl(managerCatalog, 'acme', 'sesion-ajena')).toBeNull();
});


it('revalida al vencer la próxima sesión sin mantener polling continuo', async () => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  const expiring = { ...session, status: 'scheduled', starts_at: new Date(Date.now() - 59 * 60_000).toISOString() };
  mocks.catalog.mockResolvedValueOnce({ success: true, catalog: { ...catalog, sessions: [expiring] } })
    .mockResolvedValue({ success: true, catalog: { ...catalog, total: 0, sessions: [] } });
  await act(async () => { render(<LearningSessions organizationSlug="acme" onSelect={vi.fn()} onClose={vi.fn()} />); });
  expect(screen.getByText(session.title)).toBeInTheDocument();
  await act(async () => { await vi.advanceTimersByTimeAsync(60_200); });
  expect(screen.queryByText(session.title)).toBeNull();
  expect(mocks.catalog).toHaveBeenCalledTimes(2);
  await act(async () => { await vi.advanceTimersByTimeAsync(300_000); });
  expect(mocks.catalog).toHaveBeenCalledTimes(2);
});


it('retira estado y permisos al dejar de tener organización, incluso para un slug parecido al vacío', async () => {
  mocks.catalog.mockResolvedValue({ success: true, catalog: managerCatalog });
  const view = render(<LearningSessions organizationSlug="sin-organizacion" onSelect={vi.fn()} onClose={vi.fn()} />);
  await screen.findByRole('button', { name: 'Organización' });
  view.rerender(<LearningSessions onSelect={vi.fn()} onClose={vi.fn()} />);
  expect(screen.getByText('Elige tu organización')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Organización' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Historial' })).toBeNull();
});


it('mantiene una sesión que sigue en vivo aunque supere la duración prevista', async () => {
  mocks.catalog.mockResolvedValue({ success: true, catalog: { ...catalog, sessions: [{ ...session, starts_at: '2026-11-11T15:00:00Z' }] } });
  render(<LearningSessions organizationSlug="acme" onSelect={vi.fn()} onClose={vi.fn()} />);
  await screen.findByText(session.title);
  expect(screen.getByRole('button', { name: 'Unirme a la sesión' })).toBeInTheDocument();
});
