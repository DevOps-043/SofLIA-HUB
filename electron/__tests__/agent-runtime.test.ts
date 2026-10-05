import { describe, it, expect, vi } from 'vitest';
import { AgentHarness } from '../agent-runtime/service';
import type { AgentInvocation, RunRepository } from '../agent-runtime/contracts';
import { createToolDispatcher, toolsForRole } from '../agent-runtime/tools';
import type { AgentRun, AgentScope } from '../../src/shared/agent-runtime';

const scope: AgentScope = { userId: 'usuario-a', organizationId: null };
const input = { title: 'Reunión de prueba', source: 'Ana entregará el reporte.\nFecha sin confirmar.', provider: 'gemini' as const };
function setup(execute = vi.fn(async (invocation: AgentInvocation) => ({ text: 'Acuerdo con evidencia L1: ' + invocation.role, inputTokens: 20, outputTokens: 10 }))) {
  let stored: AgentRun[] = [];
  const repository: RunRepository = { encrypted: true, load: () => structuredClone(stored), save: (_scope, runs) => { stored = structuredClone(runs); } };
  const publish = vi.fn(async () => 'reunion-1');
  const authorize = vi.fn(async () => {});
  const harness = new AgentHarness({ repository, provider: () => ({ execute }), authorize, publish });
  harness.setScope(scope);
  return { harness, execute, publish, authorize, repository };
}
async function settled(harness: AgentHarness) {
  await vi.waitFor(() => expect(harness.snapshot()[0]?.status).not.toBe('running'));
  return harness.snapshot()[0];
}
describe('Arnés multiagente', () => {
  it('ejecuta dos especialistas y después síntesis con presupuesto observable', async () => {
    const { harness, execute } = setup();
    await harness.start(input);
    const run = await settled(harness);
    expect(execute.mock.calls.map(([value]) => value.role)).toEqual(['acuerdos', 'evidencia', 'coordinador']);
    expect(run.status).toBe('review');
    expect(run.steps.every(step => step.status === 'completed')).toBe(true);
    expect(run.digest).toMatch(/^[a-f0-9]{64}$/);
    harness.close();
  });
  it('rechaza duplicados concurrentes al iniciar', async () => {
    const { harness } = setup();
    const results = await Promise.allSettled([harness.start(input), harness.start(input)]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    await settled(harness);
    harness.close();
  });
  it('no sintetiza después de cancelar aunque el proveedor ignore la señal', async () => {
    const execute = vi.fn((invocation: AgentInvocation) => {
      expect(invocation.signal.aborted).toBe(false);
      return new Promise<{ text: string; inputTokens: number; outputTokens: number }>(() => {});
    });
    const { harness } = setup(execute);
    const run = await harness.start(input);
    await vi.waitFor(() => expect(execute).toHaveBeenCalledTimes(2));
    harness.cancel(run.id);
    await vi.waitFor(() => expect(harness.snapshot()[0].steps.every(step => step.status === 'cancelled')).toBe(true));
    expect(execute).toHaveBeenCalledTimes(2);
    harness.close();
  });
  it('invalida una ejecución al cambiar de usuario y no entrega resultados tardíos', async () => {
    let release!: (value: { text: string; inputTokens: number; outputTokens: number }) => void;
    const pending = new Promise<{ text: string; inputTokens: number; outputTokens: number }>(resolve => { release = resolve; });
    const { harness } = setup(vi.fn(async () => pending));
    await harness.start(input);
    harness.setScope({ userId: 'usuario-b', organizationId: null });
    release({ text: 'Privado A', inputTokens: 0, outputTokens: 0 });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(harness.snapshot().every(run => run.scope.userId === 'usuario-b')).toBe(true);
    harness.close();
  });
  it('liga confirmación al digest y consume una sola publicación', async () => {
    const { harness, publish } = setup();
    await harness.start(input);
    const run = await settled(harness);
    await expect(harness.publish(run.id, 'incorrecto')).rejects.toThrow();
    const results = await Promise.allSettled([harness.publish(run.id, run.digest!), harness.publish(run.id, run.digest!)]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(harness.snapshot()[0].meetingRunId).toBe('reunion-1');
    harness.close();
  });
  it('no reintenta una publicación de resultado incierto', async () => {
    const { harness, publish } = setup();
    publish.mockRejectedValueOnce(new Error('Respuesta perdida'));
    await harness.start(input);
    const run = await settled(harness);
    expect((await harness.publish(run.id, run.digest!)).status).toBe('uncertain');
    await expect(harness.publish(run.id, run.digest!)).rejects.toThrow();
    expect(() => harness.recover(run.id)).toThrow();
    expect(publish).toHaveBeenCalledTimes(1);
    harness.close();
  });
  it('recupera como nueva ejecución sin reproducir efectos', async () => {
    const { harness, repository, publish } = setup();
    await harness.start(input);
    await settled(harness);
    const second = new AgentHarness({ repository, authorize: async () => {}, provider: () => ({ execute: async () => ({ text: 'Nuevo análisis', inputTokens: 0, outputTokens: 0 }) }), publish });
    second.setScope(scope);
    const old = second.snapshot()[0];
    expect(old.status).toBe('interrupted');
    expect(old.digest).toBeNull();
    const next = await second.recover(old.id);
    expect(next.parentRunId).toBe(old.id);
    expect(next.id).not.toBe(old.id);
    expect(publish).not.toHaveBeenCalled();
    second.close(); harness.close();
  });
  it('niega shell, argumentos extra y herramientas exclusivas del coordinador', async () => {
    const { harness } = setup();
    await harness.start(input);
    const run = await settled(harness);
    const dispatcher = createToolDispatcher(run, run.steps[0], new AbortController().signal, () => {});
    await expect(dispatcher('exec_command', {})).rejects.toThrow('no autorizada');
    await expect(dispatcher('leer_transcripcion', { path: '/secret' })).rejects.toThrow();
    await expect(dispatcher('leer_aportes', {})).rejects.toThrow('no autorizada');
    expect(toolsForRole('acuerdos').some(tool => tool.name === 'leer_aportes')).toBe(false);
    expect(await dispatcher('buscar_evidencia', { query: 'Ana' })).toContain('"line":1');
    harness.close();
  });
  it('no inicia proveedor ni deja una ejecución fantasma si falla el almacenamiento', async () => {
    const { harness, repository, execute } = setup();
    repository.save = () => { throw new Error('Disco lleno'); };
    await expect(harness.start(input)).rejects.toThrow('guardar');
    expect(execute).not.toHaveBeenCalled();
    expect(harness.snapshot()).toEqual([]);
    harness.close();
  });
  it('no produce efectos si no puede registrar la confirmación', async () => {
    const { harness, repository, publish } = setup();
    await harness.start(input);
    const run = await settled(harness);
    repository.save = () => { throw new Error('Disco lleno'); };
    await expect(harness.publish(run.id, run.digest!)).rejects.toThrow('confirmación');
    expect(publish).not.toHaveBeenCalled();
    expect(harness.snapshot()[0].status).toBe('review');
    harness.close();
  });
  it('vuelve a comprobar caducidad después de autorizar la operación', async () => {
    const { harness, authorize, publish } = setup();
    await harness.start(input);
    const run = await settled(harness);
    const originalDate = Date.now.bind(Date);
    const clock = vi.spyOn(Date, 'now').mockImplementation(originalDate);
    try {
      authorize.mockImplementationOnce(async () => { clock.mockReturnValue(run.approvalExpiresAt! + 1); });
      await expect(harness.publish(run.id, run.digest!)).rejects.toThrow('caducó');
      expect(publish).not.toHaveBeenCalled();
    } finally { clock.mockRestore(); harness.close(); }
  });
  it('limita consultas y niega llamadas posteriores a la cancelación', async () => {
    const { harness } = setup();
    await harness.start(input);
    const run = await settled(harness);
    const controller = new AbortController();
    run.steps[0].toolCalls = 0;
    const dispatch = createToolDispatcher(run, run.steps[0], controller.signal, () => {});
    for (let index = 0; index < 12; index++) await dispatch('leer_transcripcion', {});
    await expect(dispatch('leer_transcripcion', {})).rejects.toThrow('presupuesto');
    controller.abort();
    await expect(dispatch('buscar_evidencia', { query: 'Ana' })).rejects.toThrow('interrumpida');
    harness.close();
  });
});
