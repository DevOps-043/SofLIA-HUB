import { describe, expect, it } from 'vitest';
import { ActivityStore, activitySchema } from '../agent-activity/store';
import type { AgentActivity } from '../../src/shared/agent-activity';
const item = (): AgentActivity => ({ id: crypto.randomUUID(), sequence: 1, surface: 'chat', kind: 'document', status: 'running', agents: [{ role: 'contenido', status: 'running' }], durationMs: 0 });
describe('Monitor efímero de equipos', () => {
  it('ignora eventos atrasados y no modifica ejecuciones terminadas', () => {
    const store = new ActivityStore(); const run = item();
    expect(store.accept('renderer', run)).toBe(true);
    expect(store.accept('renderer', run)).toBe(false);
    expect(store.accept('renderer', { ...run, sequence: 3, status: 'completed' })).toBe(true);
    expect(store.accept('renderer', { ...run, sequence: 4 })).toBe(false);
    expect(store.snapshot()[0].status).toBe('completed');
  });
  it('no resucita eventos de la sesión anterior y devuelve copias', () => {
    const store = new ActivityStore(); const run = item(); store.accept('main', run);
    store.snapshot()[0].agents[0].role = 'alterado';
    expect(store.snapshot()[0].agents[0].role).toBe('contenido');
    store.clear(); expect(store.accept('main', { ...run, sequence: 2 })).toBe(false);
    expect(store.snapshot()).toEqual([]);
  });
  it('mantiene doce equipos y solo expulsa equipos terminados', () => {
    const store = new ActivityStore(); const runs = Array.from({ length: 12 }, item);
    runs.forEach(run => store.accept('main', run));
    expect(store.accept('main', item())).toBe(false);
    store.accept('main', { ...runs[0], sequence: 2, status: 'completed' });
    expect(store.accept('main', item())).toBe(true); expect(store.snapshot()).toHaveLength(12);
  });
  it('rechaza texto libre, campos extra y cargas enormes', () => {
    expect(activitySchema.safeParse({ ...item(), prompt: 'privado' }).success).toBe(false);
    expect(activitySchema.safeParse({ ...item(), agents: [{ role: 'dato privado', status: 'running' }] }).success).toBe(false);
    expect(activitySchema.safeParse({ ...item(), durationMs: Infinity }).success).toBe(false);
  });
});
