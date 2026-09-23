import { afterEach, describe, expect, it, vi } from 'vitest';
import { selectTeam, TEAM_LIMITS } from '../../shared/agent-teams/policy';
import { runAgentTeam, type TeamGenerate } from '../../shared/agent-teams/runner';

const plan = () => selectTeam({ task: 'Crea un documento de resultados', surface: 'chat' })!;
const deferred = <T>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
afterEach(() => vi.useRealTimers());

describe('Política de equipos runtime', () => {
  it.each([
    ['Crea una presentación para ventas', 'presentation'], ['Redacta un informe de resultados', 'document'],
    ['Revisa esta página web', 'browser'], ['modo equipo: explica el problema', 'analysis'],
  ])('selecciona especialistas para %s', (task, kind) => {
    expect(selectTeam({ task, surface: 'chat' })?.kind).toBe(kind);
  });
  it('omite saludos y respeta modo directo incluso con una Skill', () => {
    expect(selectTeam({ task: 'Hola', surface: 'chat' })).toBeNull();
    expect(selectTeam({ task: 'modo directo: Crea una presentación', surface: 'chat', skillId: 'sistema:presentaciones', mode: 'team' })).toBeNull();
    expect(selectTeam({ task: 'modo equipo: ', surface: 'chat' })).toBeNull();
  });
  it('prepara acciones complejas pero omite un clic aislado', () => {
    expect(selectTeam({ task: 'Abre la app y revisa el formulario', surface: 'computer' })?.kind).toBe('computer');
    expect(selectTeam({ task: 'Haz clic', surface: 'computer' })).toBeNull();
  });
});

describe('Arnés de especialistas', () => {
  it('inicia ambos trabajos antes de esperar y conserva el orden de roles', async () => {
    const gates = [deferred<string>(), deferred<string>()];
    const generate = vi.fn().mockImplementationOnce(() => gates[0].promise).mockImplementationOnce(() => gates[1].promise);
    const result = runAgentTeam({ plan: plan(), surface: 'chat', generate });
    await Promise.resolve();
    expect(generate).toHaveBeenCalledTimes(2);
    gates[1].resolve('Diseño'); gates[0].resolve('Contenido');
    expect((await result).contributions.map(item => item.text)).toEqual(['Contenido', 'Diseño']);
  });
  it('continúa con aporte parcial y no filtra errores privados', async () => {
    const result = await runAgentTeam({ plan: plan(), surface: 'whatsapp', generate: async ({ role }) => {
      if (role === 'contenido') throw new Error('clave-privada');
      return 'Estructura';
    } });
    expect(result.event.status).toBe('partial');
    expect(result.context).not.toContain('clave-privada');
    expect(result.contributions[0].status).toBe('failed');
  });
  it('acota entradas y salidas y etiqueta truncamiento', async () => {
    const p = plan(); p.task = 'x'.repeat(TEAM_LIMITS.taskChars + 1);
    const generate = vi.fn<TeamGenerate>().mockResolvedValue('y'.repeat(TEAM_LIMITS.outputChars + 20));
    const result = await runAgentTeam({ plan: p, surface: 'chat', source: 'z'.repeat(TEAM_LIMITS.sourceChars + 1), generate });
    const input = JSON.parse(generate.mock.calls[0][0].input);
    expect(input.solicitud.length).toBe(TEAM_LIMITS.taskChars);
    expect(input.datosNoConfiables.length).toBe(TEAM_LIMITS.sourceChars);
    expect(input).toMatchObject({ solicitudTruncada: true, fuenteTruncada: true });
    expect(result.contributions[0].text.length).toBe(TEAM_LIMITS.outputChars);
  });
  it('no inicia llamadas tras cancelación previa', async () => {
    const controller = new AbortController(); controller.abort('secreto'); const generate = vi.fn();
    await expect(runAgentTeam({ plan: plan(), surface: 'chat', generate, signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(generate).not.toHaveBeenCalled();
  });
  it('cancela el equipo aunque el proveedor ignore la señal y descarta resultados tardíos', async () => {
    const gate = deferred<string>(); const controller = new AbortController();
    const result = runAgentTeam({ plan: plan(), surface: 'chat', generate: () => gate.promise, signal: controller.signal });
    await Promise.resolve(); controller.abort();
    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
    gate.resolve('Tarde'); await Promise.resolve(); await Promise.resolve();
  });
  it('no encola equipos por encima del límite ni libera cupos antes de terminar las peticiones reales', async () => {
    vi.useFakeTimers();
    const gate = deferred<string>(); const generate = vi.fn(() => gate.promise);
    const a = runAgentTeam({ plan: plan(), surface: 'chat', generate });
    const b = runAgentTeam({ plan: plan(), surface: 'whatsapp', generate });
    await Promise.resolve();
    expect(generate).toHaveBeenCalledTimes(4);
    expect((await runAgentTeam({ plan: plan(), surface: 'chat', generate })).event.status).toBe('unavailable');
    await vi.advanceTimersByTimeAsync(TEAM_LIMITS.timeoutMs);
    expect((await a).contributions.every(item => item.status === 'timed_out')).toBe(true);
    await b;
    expect((await runAgentTeam({ plan: plan(), surface: 'chat', generate })).event.status).toBe('unavailable');
    gate.resolve('Tarde'); await Promise.resolve(); await Promise.resolve();
    expect((await runAgentTeam({ plan: plan(), surface: 'chat', generate: async () => 'Nuevo' })).event.status).toBe('completed');
  });
  it('no comparte fuentes entre solicitudes ni las incluye en eventos', async () => {
    const events: unknown[] = [];
    const a = vi.fn<TeamGenerate>().mockResolvedValue('A'); const b = vi.fn<TeamGenerate>().mockResolvedValue('B');
    await Promise.all([
      runAgentTeam({ plan: plan(), surface: 'chat', source: 'privado-A', generate: a, onEvent: e => events.push(e) }),
      runAgentTeam({ plan: plan(), surface: 'whatsapp', source: 'privado-B', generate: b }),
    ]);
    expect(a.mock.calls[0][0].input).not.toContain('privado-B');
    expect(b.mock.calls[0][0].input).not.toContain('privado-A');
    expect(JSON.stringify(events)).not.toContain('privado');
  });
});
