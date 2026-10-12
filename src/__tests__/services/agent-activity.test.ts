import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { agentActivityService, publishTeamActivity } from '../../services/agent-activity';
import type { AgentActivity, AgentActivityBridge } from '../../shared/agent-activity';
import type { TeamEvent } from '../../shared/agent-teams/runner';

const owner = 'sofia-activa';
const event = (overrides: Partial<TeamEvent> = {}): TeamEvent => ({
  runId: 'equipo-uno', sequence: 1, surface: 'chat', kind: 'analysis', status: 'started',
  agents: [{ role: 'analisis', status: 'running' }, { role: 'evidencia', status: 'running' }],
  workers: 2, completed: 0, durationMs: 0, ...overrides,
});
let remoteChange: (items: AgentActivity[]) => void;
let bridge: AgentActivityBridge;
const removers: Array<() => void> = [];
beforeEach(() => {
  bridge = { snapshot: vi.fn(async () => ({ success: true as const, data: [] })),
    publish: vi.fn(async () => ({ success: true as const, data: [] })),
    onChanged: vi.fn(listener => { remoteChange = listener; return vi.fn(); }) };
  window.agentActivity = bridge;
});
afterEach(() => { removers.splice(0).forEach(remove => remove()); delete window.agentActivity; vi.restoreAllMocks(); });
function subscribe(ownerId = owner) {
  const receive = vi.fn(); const error = vi.fn();
  removers.push(agentActivityService.subscribe(receive, ownerId, error));
  return { receive, error };
}

it('muestra ambos especialistas sin esperar al IPC y avisa ante rechazo controlado', async () => {
  vi.mocked(bridge.publish).mockResolvedValue({ success: false, error: 'Sesión anterior.' });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const { receive, error } = subscribe();
  publishTeamActivity(event(), owner);
  expect(receive).toHaveBeenLastCalledWith([expect.objectContaining({ id: 'renderer:equipo-uno', status: 'running', agents: event().agents })]);
  await Promise.resolve();
  expect(error).toHaveBeenLastCalledWith(expect.stringContaining('monitor compartido no está disponible'));
});

it('conserva progreso observado sin bridge y ante error de transporte', async () => {
  const { receive, error } = subscribe();
  vi.mocked(bridge.publish).mockRejectedValue(new Error('transporte'));
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  publishTeamActivity(event(), owner);
  await Promise.resolve(); await Promise.resolve();
  expect(error).toHaveBeenCalledWith(expect.stringContaining('progreso de este chat'));
  delete window.agentActivity;
  publishTeamActivity(event({ sequence: 2, status: 'updated', durationMs: 100 }), owner);
  expect(receive).toHaveBeenLastCalledWith([expect.objectContaining({ sequence: 2, durationMs: 100 })]);
});

it('deduplica confirmaciones main y no retrocede frente a avisos atrasados', () => {
  const { receive } = subscribe();
  publishTeamActivity(event(), owner);
  const initial = receive.mock.lastCall![0][0] as AgentActivity;
  remoteChange([initial]);
  publishTeamActivity(event({ sequence: 2, status: 'updated', durationMs: 800 }), owner);
  remoteChange([initial]);
  expect(receive.mock.lastCall![0]).toHaveLength(1);
  expect(receive.mock.lastCall![0][0]).toMatchObject({ sequence: 2, durationMs: 800 });
  remoteChange([{ ...initial, sequence: 2, durationMs: 800 }]);
  expect(receive.mock.lastCall![0]).toHaveLength(1);
});

it('conserva el orden reciente del monitor main', () => {
  const { receive } = subscribe();
  const base: AgentActivity = { id: 'main:uno', sequence: 1, surface: 'browser', kind: 'browser', status: 'running', durationMs: 0, agents: event().agents };
  remoteChange([{ ...base, id: 'main:dos' }, base]);
  expect(receive.mock.lastCall![0].map((item: AgentActivity) => item.id)).toEqual(['main:dos', 'main:uno']);
});

it('descarta eventos de otra identidad y eventos tardíos tras cambiar de usuario', async () => {
  const { receive } = subscribe();
  publishTeamActivity(event(), 'lia-ajena');
  expect(receive).not.toHaveBeenCalled();
  removers.splice(0).forEach(remove => remove());
  const next = subscribe('sofia-nueva');
  publishTeamActivity(event({ sequence: 2, status: 'updated' }), owner);
  await Promise.resolve();
  expect(next.receive).not.toHaveBeenCalled();
  expect(next.error.mock.calls.every(([error]) => error === '')).toBe(true);
});

it('no resucita equipos sin inicio ni equipos ya finalizados', () => {
  const { receive } = subscribe();
  publishTeamActivity(event({ sequence: 2, status: 'updated' }), owner);
  expect(receive).not.toHaveBeenCalled();
  publishTeamActivity(event(), owner);
  publishTeamActivity(event({ sequence: 3, status: 'completed', completed: 2, agents: event().agents.map(agent => ({ ...agent, status: 'completed' })) }), owner);
  const calls = receive.mock.calls.length;
  publishTeamActivity(event({ sequence: 4, status: 'updated' }), owner);
  expect(receive).toHaveBeenCalledTimes(calls);
});

it('acota la actividad local a doce equipos y elimina el finalizado más antiguo', () => {
  const { receive } = subscribe();
  for (let index = 0; index < 13; index++) {
    const runId = `equipo-${index}`;
    publishTeamActivity(event({ runId }), owner);
    publishTeamActivity(event({ runId, sequence: 2, status: 'completed' }), owner);
  }
  const items = receive.mock.lastCall![0] as AgentActivity[];
  expect(items).toHaveLength(12);
  expect(items.some(item => item.id === 'renderer:equipo-0')).toBe(false);
  expect(items[0].id).toBe('renderer:equipo-12');
});

it('retira escuchas locales y rechazos pendientes al desmontar', async () => {
  const { receive, error } = subscribe();
  vi.mocked(bridge.publish).mockResolvedValue({ success: false, error: 'rechazado' });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  publishTeamActivity(event(), owner);
  removers.splice(0).forEach(remove => remove());
  publishTeamActivity(event({ sequence: 2, status: 'updated' }), owner);
  await Promise.resolve();
  expect(receive).toHaveBeenCalledTimes(1);
  expect(error).not.toHaveBeenCalled();
});

it('conserva equipos del snapshot inicial cuando comienza un local y su publicación falla', async () => {
  const previous: AgentActivity = { id: 'main:whatsapp', sequence: 1, surface: 'whatsapp', kind: 'analysis', status: 'running', durationMs: 0, agents: event().agents };
  vi.mocked(bridge.snapshot).mockResolvedValue({ success: true, data: [previous] });
  vi.mocked(bridge.publish).mockResolvedValue({ success: false, error: 'rechazado' });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const { receive } = subscribe();
  await Promise.resolve(); await Promise.resolve();
  publishTeamActivity(event(), owner);
  expect(receive.mock.lastCall![0].map((item: AgentActivity) => item.id)).toEqual(['renderer:equipo-uno', 'main:whatsapp']);
});

it('combina el snapshot tardío con progreso local y descarta un snapshot previo a un evento main', async () => {
  let resolve!: (reply: { success: true; data: AgentActivity[] }) => void;
  vi.mocked(bridge.snapshot).mockReturnValue(new Promise(done => { resolve = done; }));
  const previous: AgentActivity = { id: 'main:whatsapp', sequence: 1, surface: 'whatsapp', kind: 'analysis', status: 'running', durationMs: 0, agents: event().agents };
  const { receive } = subscribe();
  publishTeamActivity(event(), owner);
  resolve({ success: true, data: [previous] });
  await Promise.resolve(); await Promise.resolve();
  expect(receive.mock.lastCall![0]).toHaveLength(2);
  removers.splice(0).forEach(remove => remove());
  const next = subscribe();
  remoteChange([{ ...previous, sequence: 2, status: 'completed' }]);
  await Promise.resolve(); await Promise.resolve();
  expect(next.receive).toHaveBeenLastCalledWith([expect.objectContaining({ sequence: 2, status: 'completed' })]);
});

it('prioriza un equipo remoto activo frente a doce locales finalizados sin confirmar', () => {
  const { receive } = subscribe();
  for (let index = 0; index < 12; index++) {
    const runId = `local-${index}`;
    publishTeamActivity(event({ runId }), owner);
    publishTeamActivity(event({ runId, sequence: 2, status: 'completed' }), owner);
  }
  const remote: AgentActivity = { id: 'main:nuevo', sequence: 1, surface: 'browser', kind: 'browser', status: 'running', durationMs: 0, agents: event().agents };
  remoteChange([remote]);
  const items = receive.mock.lastCall![0] as AgentActivity[];
  expect(items).toHaveLength(12);
  expect(items[0]).toEqual(remote);
});

it('ordena equipos locales y remotos por llegada sin anteponer locales finalizados', () => {
  const { receive } = subscribe();
  publishTeamActivity(event(), owner);
  publishTeamActivity(event({ sequence: 2, status: 'completed' }), owner);
  const remote: AgentActivity = { id: 'main:nuevo', sequence: 2, surface: 'browser', kind: 'browser', status: 'completed', durationMs: 0, agents: event().agents };
  remoteChange([remote]);
  expect(receive.mock.lastCall![0].map((item: AgentActivity) => item.id)).toEqual(['main:nuevo', 'renderer:equipo-uno']);
});
