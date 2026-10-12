import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AgentActivityButton } from '../../components/agents/AgentActivityButton';
import { AgentActivityPanel } from '../../components/agents/AgentActivityPanel';
import { AgentActivityProvider } from '../../components/agents/AgentActivityProvider';
import { agentActivityService } from '../../services/agent-activity';
import type { AgentActivity } from '../../shared/agent-activity';
import { publishTeamActivity } from '../../services/agent-activity';
import type { TeamEvent } from '../../shared/agent-teams/runner';

const auth = vi.hoisted(() => ({ ownerId: 'sofia-activa' }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: auth.ownerId } }) }));

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); auth.ownerId = 'sofia-activa'; delete window.agentActivity; });

const team = (id: string, surface: AgentActivity['surface']): AgentActivity => ({
  id, sequence: 1, surface, kind: 'presentation', status: 'running', durationMs: 300,
  agents: [{ role: 'contenido', status: 'completed' }, { role: 'diseno', status: 'running' }],
});

function renderMonitor() {
  let change!: (items: AgentActivity[]) => void; const remove = vi.fn();
  vi.spyOn(agentActivityService, 'subscribe').mockImplementation(listener => { change = listener; return remove; });
  vi.spyOn(agentActivityService, 'snapshot').mockResolvedValue([]);
  const view = render(<AgentActivityProvider><AgentActivityButton /><AgentActivityPanel /></AgentActivityProvider>);
  return { view, remove, change: (items: AgentActivity[]) => act(() => change(items)) };
}

it('abre el panel flotante con un equipo nuevo, permite plegar y retira la suscripción', async () => {
  const { view, remove, change } = renderMonitor();
  await act(async () => {});
  expect(screen.queryByRole('complementary', { name: 'Archivos de SofLIA' })).not.toBeInTheDocument();

  change([team('uno', 'whatsapp')]);
  expect(screen.getByRole('complementary', { name: 'Archivos de SofLIA' })).toBeInTheDocument();
  expect(screen.getByText('WhatsApp')).toBeInTheDocument();
  expect(screen.getByText('En progreso')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Ocultar archivos de SofLIA' })).toHaveAttribute('aria-pressed', 'true');

  fireEvent.click(screen.getByRole('button', { expanded: true }));
  expect(screen.queryByText('Diseño')).not.toBeInTheDocument();

  view.unmount();
  expect(remove).toHaveBeenCalled();
});

it('ocultar no se revierte con actualizaciones del mismo equipo y el botón lo recupera', async () => {
  const { change } = renderMonitor();
  await act(async () => {});
  change([team('uno', 'orb')]);

  fireEvent.click(screen.getByRole('button', { name: 'Ocultar panel de archivos' }));
  expect(screen.queryByRole('complementary', { name: 'Archivos de SofLIA' })).not.toBeInTheDocument();

  change([{ ...team('uno', 'orb'), sequence: 2 }]);
  expect(screen.queryByRole('complementary', { name: 'Archivos de SofLIA' })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Ver archivos de SofLIA' }));
  expect(screen.getByText('Orbe')).toBeInTheDocument();
});

it('omite el acceso fuera del proveedor', () => {
  const { container } = render(<AgentActivityButton />);
  expect(container).toBeEmptyDOMElement();
});

it('muestra estado vacío compacto y permite cerrar con Escape', async () => {
  renderMonitor();
  await act(async () => {});
  fireEvent.click(screen.getByRole('button', { name: 'Ver archivos de SofLIA' }));
  expect(screen.getByText('Tus archivos, a mano')).toBeInTheDocument();
  expect(screen.queryByText('Sin equipos activos')).not.toBeInTheDocument();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('complementary', { name: 'Archivos de SofLIA' })).not.toBeInTheDocument();
});

it('actualiza solo el estado global sin roles, operaciones ni contadores de agentes', async () => {
  const { change } = renderMonitor(); await act(async () => {});
  change([team('dos', 'chat')]);
  expect(screen.getByText('En progreso')).toBeInTheDocument();
  expect(screen.queryByText('Diseño')).not.toBeInTheDocument();
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  change([{ ...team('dos', 'chat'), sequence: 3, status: 'completed' }]);
  expect(screen.getByText('Listo')).toBeInTheDocument();
  expect(screen.getByText('Resultado disponible en el chat.')).toBeInTheDocument();
});
it('recuerda el ancho elegido y permite recuperarlo sin recargar el monitor', async () => {
  localStorage.removeItem('soflia:files-panel-width');
  const { change } = renderMonitor(); await act(async () => {}); change([team('ancho', 'chat')]);
  const separator = screen.getByRole('separator', { name: 'Cambiar ancho de archivos' });
  fireEvent.keyDown(separator, { key: 'End' });
  expect(separator.getAttribute('aria-valuenow')).toBe(separator.getAttribute('aria-valuemax'));
  expect(localStorage.getItem('soflia:files-panel-width')).toBe(separator.getAttribute('aria-valuenow'));
  localStorage.removeItem('soflia:files-panel-width');
});

it('muestra eventos reales del chat ante rechazo y retira el estado al cambiar identidad', async () => {
  window.agentActivity = { snapshot: vi.fn(async () => ({ success: true as const, data: [] })), publish: vi.fn(async () => ({ success: false as const, error: 'rechazado' })), onChanged: vi.fn(() => vi.fn()) };
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const element = <AgentActivityProvider><AgentActivityButton /><AgentActivityPanel /></AgentActivityProvider>;
  const view = render(element);
  await act(async () => {});
  const event: TeamEvent = { runId: 'equipo-real', sequence: 1, surface: 'chat', kind: 'analysis', status: 'started', workers: 2, completed: 0, durationMs: 0, agents: [{ role: 'analisis', status: 'running' }, { role: 'evidencia', status: 'running' }] };
  await act(async () => { publishTeamActivity(event, auth.ownerId); });
  expect(screen.getByText('En progreso')).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('monitor compartido no está disponible');
  auth.ownerId = 'sofia-nueva';
  view.rerender(<AgentActivityProvider><AgentActivityButton /><AgentActivityPanel /></AgentActivityProvider>);
  await act(async () => {});
  expect(screen.queryByRole('complementary', { name: 'Archivos de SofLIA' })).not.toBeInTheDocument();
  await act(async () => { publishTeamActivity({ ...event, sequence: 2, status: 'updated' }, 'sofia-activa'); });
  expect(screen.queryByText('En progreso')).not.toBeInTheDocument();
});
