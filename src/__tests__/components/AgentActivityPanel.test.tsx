import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AgentActivityButton } from '../../components/agents/AgentActivityButton';
import { AgentActivityPanel } from '../../components/agents/AgentActivityPanel';
import { AgentActivityProvider } from '../../components/agents/AgentActivityProvider';
import { agentActivityService } from '../../services/agent-activity';
import type { AgentActivity } from '../../shared/agent-activity';

afterEach(() => vi.restoreAllMocks());

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

it('abre el panel acoplado con un equipo nuevo, permite plegar y retira la suscripción', async () => {
  const { view, remove, change } = renderMonitor();
  await act(async () => {});
  expect(screen.queryByRole('complementary', { name: 'Equipo de SofLIA' })).not.toBeInTheDocument();

  change([team('uno', 'whatsapp')]);
  expect(screen.getByRole('complementary', { name: 'Equipo de SofLIA' })).toBeInTheDocument();
  expect(screen.getByText('WhatsApp')).toBeInTheDocument();
  expect(screen.getByText('Trabajando')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Ocultar equipos de agentes' })).toHaveAttribute('aria-pressed', 'true');

  fireEvent.click(screen.getByRole('button', { expanded: true }));
  expect(screen.queryByText('Diseño')).not.toBeInTheDocument();

  view.unmount();
  expect(remove).toHaveBeenCalled();
});

it('ocultar no se revierte con actualizaciones del mismo equipo y el botón lo recupera', async () => {
  const { change } = renderMonitor();
  await act(async () => {});
  change([team('uno', 'orb')]);

  fireEvent.click(screen.getByRole('button', { name: 'Ocultar panel de equipos' }));
  expect(screen.queryByRole('complementary', { name: 'Equipo de SofLIA' })).not.toBeInTheDocument();

  change([{ ...team('uno', 'orb'), sequence: 2 }]);
  expect(screen.queryByRole('complementary', { name: 'Equipo de SofLIA' })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Ver equipos de agentes' }));
  expect(screen.getByText('Orbe')).toBeInTheDocument();
});

it('omite el acceso fuera del proveedor', () => {
  const { container } = render(<AgentActivityButton />);
  expect(container).toBeEmptyDOMElement();
});
