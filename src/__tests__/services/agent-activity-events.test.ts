import { expect, it, vi } from 'vitest';
import { runAgentTeam, subscribeTeamEvents, type TeamEvent } from '../../shared/agent-teams/runner';
import { selectTeam } from '../../shared/agent-teams/policy';
it('publica estados independientes, secuencia y cierre sin contenido privado', async () => {
  const events: TeamEvent[] = []; const remove = subscribeTeamEvents(event => events.push(event));
  try {
    await runAgentTeam({ plan: selectTeam({ task: 'Crea un documento privado', surface: 'chat' })!, surface: 'chat', generate: async ({ role }) => { if (role === 'contenido') throw new Error('secreto'); return 'contenido privado'; } });
    expect(events.map(event => event.sequence)).toEqual([1, 2, 3, 4]);
    expect(new Set(events.map(event => event.runId)).size).toBe(1);
    expect(events[0].agents.every(agent => agent.status === 'running')).toBe(true);
    expect(events[events.length - 1]?.status).toBe('partial');
    expect(events[events.length - 1]?.agents.map(agent => agent.status).sort()).toEqual(['completed', 'failed']);
    expect(JSON.stringify(events)).not.toContain('privado');
    expect(JSON.stringify(events)).not.toContain('secreto');
  } finally { remove(); }
});
it('un observador roto no interrumpe los especialistas', async () => {
  const log = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const remove = subscribeTeamEvents(() => { throw new Error('observador roto'); });
  try { const result = await runAgentTeam({ plan: selectTeam({ task: 'Crea un documento', surface: 'chat' })!, surface: 'chat', generate: async () => 'listo' }); expect(result.event.status).toBe('completed'); }
  finally { remove(); log.mockRestore(); }
});
