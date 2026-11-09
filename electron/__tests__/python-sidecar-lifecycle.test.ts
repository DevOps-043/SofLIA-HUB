import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PythonRuntimeService } from '../python-runtime-service';
import { PythonToolsService } from '../python-tools-service';
import { SidecarConnection, SIDECAR_MAX_LINE_BYTES, SIDECAR_MAX_PENDING, SIDECAR_MAX_WRITE_BYTES } from '../python/sidecar-connection';
import { BoundedNdjson } from '../python/ndjson';

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }));
vi.mock('node:child_process', async original => ({ ...await original<typeof import('node:child_process')>(), spawn: spawnMock }));
function child() {
  const proc = Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), killed: false, ackShutdown: true,
    kill: vi.fn(() => { proc.killed = true; return true; }) });
  const requests: { id?: number; cmd: string; params?: Record<string, unknown> }[] = [];
  let buffer = '';
  proc.stdin.on('data', chunk => {
    buffer += String(chunk); while (buffer.includes('\n')) {
      const index = buffer.indexOf('\n'); const request = JSON.parse(buffer.slice(0, index)); buffer = buffer.slice(index + 1); requests.push(request);
      if (request.cmd === 'shutdown' && proc.ackShutdown) queueMicrotask(() => proc.stdout.write(JSON.stringify({ id: request.id, ok: true, bye: true, data: { bye: true } }) + '\n'));
    }
  });
  return { proc, requests, ready: (protocol: number) => proc.stdout.write(JSON.stringify({ event: 'ready', protocol }) + '\n'),
    respond: (id: number, payload: Record<string, unknown>) => proc.stdout.write(JSON.stringify({ id, ok: true, ...payload }) + '\n') };
}
const services: { stop(): Promise<void> }[] = [];
const children: ReturnType<typeof child>[] = [];
function voice() {
  const service = new PythonRuntimeService(); services.push(service);
  service.configureCaptureAuthorization(() => {});
  vi.spyOn(service as unknown as { assertRuntimeAvailable(): void }, 'assertRuntimeAvailable').mockImplementation(() => {});
  return service;
}
function createChild() { const item = child(); children.push(item); spawnMock.mockReturnValueOnce(item.proc); return item; }
beforeEach(() => { spawnMock.mockReset(); });
afterEach(async () => {
  for (const service of services.splice(0)) await service.stop();
  for (const item of children.splice(0)) { item.proc.emit('exit', 0); item.proc.emit('close', 0); item.proc.stdin.destroy(); item.proc.stdout.destroy(); item.proc.stderr.destroy(); }
  vi.restoreAllMocks();
  vi.useRealTimers();
});
describe('Propiedad de generación Python', () => {
  it('detener dictado antes de ready impide enviar su captura tardía', async () => {
    const service = voice();
    vi.spyOn(service as unknown as { resolveDictationModelPath(): string }, 'resolveDictationModelPath').mockReturnValue('C:/modelo-ficticio');
    const item = createChild(); let id!: string;
    const pending = service.startDictation(value => { id = value; });
    expect(id).toMatch(/^dictation-/); expect(spawnMock).toHaveBeenCalledOnce();
    const stopping = service.stopDictation(id); item.ready(4);
    await stopping;
    expect(await pending).toMatchObject({ success: false }); expect(item.requests.some(request => request.cmd === 'start_dictation')).toBe(false);
  });
  it('voz: dos consumidores esperan el mismo ready antes de completar startup', async () => {
    const service = voice(); const item = createChild(); const first = service.ensureSidecarRunning();
    let secondReady = false; const second = service.ensureSidecarRunning().then(() => { secondReady = true; });
    try { await Promise.resolve(); await Promise.resolve(); expect(secondReady).toBe(false); expect(spawnMock).toHaveBeenCalledOnce(); }
    finally { item.ready(4); await Promise.all([first, second]); }
  });
  it('voz: exit/error/stdout de A retirado no invalidan B ni su petición', async () => {
    const service = voice(); const a = createChild(); const startedA = service.ensureSidecarRunning(); a.ready(4); await startedA; await service.stop();
    const b = createChild(); const startedB = service.ensureSidecarRunning(); b.ready(4); await startedB;
    const wake = vi.fn(); service.on('wake-word', wake);
    const response = expect(service.sendCommand('ping', {})).resolves.toMatchObject({ ok: true, pong: true });
    a.proc.emit('exit', 1); a.proc.emit('error', Object.assign(new Error('secreto-ficticio'), { code: 'EIO' }));
    a.proc.stdout.write('{"event":"wake_word","text":"texto-antiguo"}\n');
    const request = b.requests.find(item => item.cmd === 'ping')!; b.respond(request.id!, { pong: true });
    await response; expect(service.getStatus().sidecarRunning).toBe(true); expect(service.getStatus().lastError).toBeNull(); expect(wake).not.toHaveBeenCalled();
  });
  it('tools: los consumidores concurrentes no escriben antes del ready', async () => {
    const service = new PythonToolsService(); services.push(service); vi.spyOn(service, 'isAvailable').mockReturnValue(true);
    const item = createChild(); const first = service.analyzePii('primero'); const second = service.analyzePii('segundo');
    try { await Promise.resolve(); await Promise.resolve(); expect(item.requests).toEqual([]); }
    finally {
      item.ready(1); await vi.waitFor(() => expect(item.requests.filter(value => value.cmd === 'analyze_pii')).toHaveLength(2));
      for (const request of item.requests.filter(value => value.cmd === 'analyze_pii')) item.respond(request.id!, { data: { entities: [], engine: 'ficticio' } });
      await Promise.all([first, second]);
    }
  });
  it('tools: un exit/error de A retirado no rechaza la operación de B', async () => {
    const service = new PythonToolsService(); services.push(service); vi.spyOn(service, 'isAvailable').mockReturnValue(true);
    const a = createChild(); const first = service.analyzePii('A'); a.ready(1);
    await vi.waitFor(() => expect(a.requests).toHaveLength(1)); a.respond(a.requests[0].id!, { data: { entities: [], engine: 'A' } }); await first; await service.stop();
    const b = createChild(); const second = service.analyzePii('B'); b.ready(1);
    await vi.waitFor(() => expect(b.requests).toHaveLength(1));
    a.proc.emit('exit', 1); a.proc.emit('error', new Error('error-antiguo'));
    b.respond(b.requests[0].id!, { data: { entities: [], engine: 'B' } });
    expect(await second).toEqual({ success: true, data: { entities: [], engine: 'B' } }); expect(service.getStatus().running).toBe(true);
  });
  it('stop durante startup retira voz antes de enviar start_wake', async () => {
    const service = voice(); vi.spyOn(service as unknown as { resolveWakeModelPath(): string }, 'resolveWakeModelPath').mockReturnValue('C:/modelo-ficticio');
    const item = createChild(); const pending = service.startPassiveListening(); await service.stop(); item.ready(4);
    expect(await pending).toMatchObject({ success: false }); expect(item.requests).toEqual([]); expect(service.getStatus().listening).toBe(false);
  });
  it('deshabilitar configuración durante startup invalida start_wake pendiente', async () => {
    const service = voice(); const internal = service as unknown as { resolveWakeModelPath(): string; saveConfig(): void };
    vi.spyOn(internal, 'resolveWakeModelPath').mockReturnValue('C:/modelo-ficticio'); vi.spyOn(internal, 'saveConfig').mockImplementation(() => {});
    const item = createChild(); const pending = service.startPassiveListening(); await service.setConfig({ enabled: false }); item.ready(4);
    expect(await pending).toMatchObject({ success: false }); expect(item.requests).toEqual([]); expect(service.getStatus().listening).toBe(false);
  });
  it('tools: una respuesta recibida justo antes de stop no se publica como éxito después', async () => {
    const service = new PythonToolsService(); services.push(service); vi.spyOn(service, 'isAvailable').mockReturnValue(true);
    const item = createChild(); const pending = service.analyzePii('texto-ficticio'); item.ready(1);
    await vi.waitFor(() => expect(item.requests).toHaveLength(1)); item.respond(item.requests[0].id!, { data: { entities: [], engine: 'ficticio' } });
    const stopping = service.stop(); expect(await pending).toMatchObject({ success: false, error: { code: 'SIDECAR_STOPPED' } }); await stopping;
  });
  it('un arranque explícito espera shutdown pendiente y luego usa otro hijo', async () => {
    const service = voice(); const a = createChild(); const first = service.ensureSidecarRunning(); a.ready(4); await first;
    a.proc.ackShutdown = false; const stopping = service.stop(); const b = createChild(); const next = service.ensureSidecarRunning();
    await Promise.resolve(); expect(spawnMock).toHaveBeenCalledOnce();
    a.respond(a.requests.find(request => request.cmd === 'shutdown')!.id!, { bye: true }); await stopping;
    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(2)); b.ready(4); await next;
    expect(service.getStatus().sidecarRunning).toBe(true);
  });
  it('stop cancela el reinicio de escucha antes de vencer backoff', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const service = voice(); const internal = service as unknown as { config: { enabled: boolean }; resolveWakeModelPath(): string; resolveDictationModelPath(): string };
    internal.config.enabled = true; vi.spyOn(internal, 'resolveWakeModelPath').mockReturnValue('C:/modelo-ficticio');
    vi.spyOn(internal, 'resolveDictationModelPath').mockReturnValue('C:/modelo-ficticio');
    const a = createChild(); const starting = service.startPassiveListening(); a.ready(4);
    await vi.waitFor(() => expect(a.requests).toHaveLength(1)); a.respond(a.requests[0].id!, {}); expect(await starting).toEqual({ success: true });
    a.proc.emit('exit', 1); expect(vi.getTimerCount()).toBe(1); await service.stop();
    await vi.advanceTimersByTimeAsync(5000); expect(spawnMock).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
  });
  it('el reinicio vigente restaura wake aunque otro consumidor ya abrió el nuevo hijo', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const service = voice(); const internal = service as unknown as { config: { enabled: boolean }; resolveWakeModelPath(): string; resolveDictationModelPath(): string };
    internal.config.enabled = true; vi.spyOn(internal, 'resolveWakeModelPath').mockReturnValue('C:/modelo-ficticio'); vi.spyOn(internal, 'resolveDictationModelPath').mockReturnValue('C:/modelo-ficticio');
    const a = createChild(); const waking = service.startPassiveListening(); a.ready(4);
    await vi.waitFor(() => expect(a.requests).toHaveLength(1)); a.respond(a.requests[0].id!, {}); await waking; a.proc.emit('exit', 1);
    const b = createChild(); const opened = service.ensureSidecarRunning(); b.ready(4); await opened;
    await vi.advanceTimersByTimeAsync(1000);
    try { expect(b.requests.find(request => request.cmd === 'start_wake')).toBeDefined(); }
    finally { for (const request of b.requests.filter(value => value.cmd === 'start_wake')) b.respond(request.id!, {}); await vi.advanceTimersByTimeAsync(0); }
  });
  it.each(['voz', 'tools'])('%s: otra orden stop invalida el arranque que esperaba el primer cierre', async kind => {
    const service = kind === 'voz' ? voice() : new PythonToolsService(); if (kind === 'tools') { services.push(service); vi.spyOn(service as PythonToolsService, 'isAvailable').mockReturnValue(true); }
    const a = createChild(); const first = service instanceof PythonRuntimeService ? service.ensureSidecarRunning() : service.analyzePii('ficticio'); a.ready(kind === 'voz' ? 4 : 1);
    if (kind === 'tools') { await vi.waitFor(() => expect(a.requests).toHaveLength(1)); a.respond(a.requests[0].id!, { data: { entities: [], engine: 'ficticio' } }); } await first;
    a.proc.ackShutdown = false; const stopping = service.stop(); let completed = false;
    const pending = (service instanceof PythonRuntimeService ? service.ensureSidecarRunning() : service.analyzePii('ficticio')).then(result => { completed = !result || result.success; }, () => {});
    const b = createChild(); const again = service.stop();
    a.respond(a.requests.find(request => request.cmd === 'shutdown')!.id!, {}); await Promise.all([stopping, again]);
    await Promise.resolve(); await Promise.resolve(); b.ready(kind === 'voz' ? 4 : 1); await pending;
    expect(completed).toBe(false); expect(spawnMock).toHaveBeenCalledOnce();
  });
  it('tools: tres fallos de startup agotan presupuesto sin dejar promesas huérfanas', async () => {
    const service = new PythonToolsService(); services.push(service); vi.spyOn(service, 'isAvailable').mockReturnValue(true);
    for (let attempt = 0; attempt < 3; attempt++) {
      const item = createChild(); const pending = service.analyzePii('ficticio'); item.proc.emit('error', Object.assign(new Error('secreto-ficticio'), { code: 'ENOENT' }));
      expect(await pending).toMatchObject({ success: false, error: { code: 'SIDECAR_START_FAILED' } });
    }
    expect(await service.analyzePii('ficticio')).toMatchObject({ success: false, error: { code: 'SIDECAR_START_FAILED' } }); expect(spawnMock).toHaveBeenCalledTimes(3);
  });
  it('los errores síncronos de spawn tampoco filtran contenido ni evaden presupuesto', async () => {
    const service = voice(); spawnMock.mockImplementation(() => { throw new Error('secreto-ficticio'); });
    await expect(service.ensureSidecarRunning()).rejects.toMatchObject({ code: 'SIDECAR_START_FAILED', message: 'No se pudo lanzar el sidecar Python.' });
    const tools = new PythonToolsService(); services.push(tools); vi.spyOn(tools, 'isAvailable').mockReturnValue(true); spawnMock.mockClear();
    for (let attempt = 0; attempt < 4; attempt++) expect(await tools.analyzePii('ficticio')).toMatchObject({ success: false, error: { code: 'SIDECAR_START_FAILED' } });
    expect(spawnMock).toHaveBeenCalledTimes(3);
  });
  it.each(['voz', 'tools'])('%s no reemplaza un hijo cuyo kill no se confirmó hasta recibir close', async kind => {
    const service = kind === 'voz' ? voice() : new PythonToolsService(); if (kind === 'tools') { services.push(service); vi.spyOn(service as PythonToolsService, 'isAvailable').mockReturnValue(true); }
    const a = createChild();
    let first: Promise<unknown>;
    if (service instanceof PythonRuntimeService) first = service.ensureSidecarRunning();
    else first = service.analyzePii('ficticio');
    a.ready(kind === 'voz' ? 4 : 1);
    if (kind === 'tools') { await vi.waitFor(() => expect(a.requests).toHaveLength(1)); a.respond(a.requests[0].id!, { data: { entities: [], engine: 'ficticio' } }); }
    await first; a.proc.kill.mockImplementationOnce(() => { throw new Error('secreto-ficticio'); });
    await expect(service.stop()).rejects.toMatchObject({ code: 'SIDECAR_STOP_UNCONFIRMED' });
    if (service instanceof PythonRuntimeService) await expect(service.ensureSidecarRunning()).rejects.toMatchObject({ code: 'SIDECAR_STOP_UNCONFIRMED' });
    else expect(await service.analyzePii('ficticio')).toMatchObject({ success: false, error: { code: 'SIDECAR_STOP_UNCONFIRMED' } });
    expect(spawnMock).toHaveBeenCalledOnce(); a.proc.emit('close', 0); await Promise.resolve();
    const b = createChild();
    const next = service instanceof PythonRuntimeService ? service.ensureSidecarRunning() : service.analyzePii('ficticio'); b.ready(kind === 'voz' ? 4 : 1);
    if (kind === 'tools') { await vi.waitFor(() => expect(b.requests).toHaveLength(1)); b.respond(b.requests[0].id!, { data: { entities: [], engine: 'ficticio' } }); }
    await next; expect(spawnMock).toHaveBeenCalledTimes(2);
  });
});

function transport(protocol = 4) {
  const item = createChild(), onMessage = vi.fn(), onClosed = vi.fn();
  const connection = new SidecarConnection(item.proc as unknown as ChildProcessWithoutNullStreams, { protocol, readyTimeoutMs: 1000, onMessage, onClosed });
  services.push(connection); const started = connection.start();
  return { ...item, connection, started, onMessage, onClosed };
}
describe('Transporte NDJSON acotado', () => {
  it.each(['null', '[]', '123', 'no-json', '{"event":"ready","protocol":3}'])('rechaza startup incompatible %s y libera timer', async line => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }); const f = transport(); f.proc.stdout.write(line + '\n');
    await expect(f.started).rejects.toMatchObject({ code: 'SIDECAR_PROTOCOL_ERROR' });
    expect(f.onClosed).toHaveBeenCalledOnce(); expect(f.proc.kill).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
  });
  it('exit antes de ready falla inmediatamente y no deja listeners de preparación', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }); const f = transport(); f.proc.emit('exit', 1);
    await expect(f.started).rejects.toMatchObject({ code: 'SIDECAR_CRASHED' }); expect(vi.getTimerCount()).toBe(0);
  });
  it('ready timeout retira el proceso y permite observar su fallo', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }); const f = transport();
    const rejected = expect(f.started).rejects.toMatchObject({ code: 'SIDECAR_READY_TIMEOUT' });
    await vi.advanceTimersByTimeAsync(1000); await rejected; expect(f.connection.running).toBe(false); expect(f.proc.kill).toHaveBeenCalledOnce();
  });
  it('spawn usa código de SO permitido sin propagar mensaje/path', async () => {
    const f = transport(); f.proc.emit('error', Object.assign(new Error('secreto-ficticio'), { code: 'ENOENT' }));
    await expect(f.started).rejects.toMatchObject({ message: 'No se pudo lanzar el sidecar Python (ENOENT).' });
    expect(f.onClosed.mock.calls[0][0].message).not.toContain('secreto-ficticio');
  });
  it('respuestas fuera de orden se asocian por id y no se duplican', async () => {
    const f = transport(); f.ready(4); await f.started;
    const one = f.connection.request('ping', {}, 1000), two = f.connection.request('ping', {}, 1000);
    f.respond(f.requests[1].id!, { value: 2 }); f.respond(f.requests[0].id!, { value: 1 });
    expect(await one).toMatchObject({ value: 1 }); expect(await two).toMatchObject({ value: 2 }); expect(f.requests).toHaveLength(2);
  });
  it('64 peticiones pendientes rechazan la siguiente antes de escribir', async () => {
    const f = transport(); f.ready(4); await f.started;
    const pending = Array.from({ length: SIDECAR_MAX_PENDING }, () => f.connection.request('ping', {}, 1000));
    await expect(f.connection.request('ping', {}, 1000)).rejects.toMatchObject({ code: 'SIDECAR_BUSY' }); expect(f.requests).toHaveLength(SIDECAR_MAX_PENDING);
    for (const request of f.requests) f.respond(request.id!, {}); await Promise.all(pending);
  });
  it('timeout no reenvía el comando y una respuesta tardía no resuelve la siguiente', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }); const f = transport(); f.ready(4); await f.started;
    const rejected = expect(f.connection.request('ping', {}, 50)).rejects.toMatchObject({ code: 'TIMEOUT' });
    await vi.advanceTimersByTimeAsync(50); await rejected;
    const next = f.connection.request('ping', {}, 50); f.respond(f.requests[0].id!, { value: 'viejo' }); f.respond(f.requests[1].id!, { value: 'actual' });
    expect(await next).toMatchObject({ value: 'actual' }); expect(f.requests).toHaveLength(2); expect(vi.getTimerCount()).toBe(0);
  });
  it('rechaza payload no serializable, demasiado grande y timeout inválido sin escribir', async () => {
    const f = transport(); f.ready(4); await f.started; const cycle: Record<string, unknown> = {}; cycle.self = cycle;
    await expect(f.connection.request('ping', cycle, 10)).rejects.toMatchObject({ code: 'SIDECAR_INVALID_REQUEST' });
    await expect(f.connection.request('ping', { value: 'x'.repeat(SIDECAR_MAX_WRITE_BYTES) }, 10)).rejects.toMatchObject({ code: 'SIDECAR_PAYLOAD_TOO_LARGE' });
    await expect(f.connection.request('ping', {}, Infinity)).rejects.toMatchObject({ code: 'SIDECAR_INVALID_REQUEST' }); expect(f.requests).toEqual([]);
  });
  it('cola llena rechaza antes de escribir y write(false) no provoca duplicar notificaciones', async () => {
    const f = transport(); f.ready(4); await f.started;
    const length = vi.spyOn(f.proc.stdin, 'writableLength', 'get').mockReturnValue(SIDECAR_MAX_WRITE_BYTES);
    expect(f.connection.notify('meeting_audio', { audio_b64: 'ficticio' })).toBe(false); expect(f.requests).toEqual([]); length.mockRestore();
    const write = vi.spyOn(f.proc.stdin, 'write').mockReturnValueOnce(false);
    expect(f.connection.notify('meeting_audio', { audio_b64: 'ficticio' })).toBe(true); expect(write).toHaveBeenCalledOnce();
  });
  it.each(['{"id":1,"ok":"sí"}', '{"id":0,"ok":true}', '{"event":"ready","protocol":4}', '{"id":1,"ok":true,"event":"error"}'])('cierra generación ante respuesta inválida: %s', async line => {
    const f = transport(); f.ready(4); await f.started; const failed = expect(f.connection.request('ping', {}, 1000)).rejects.toMatchObject({ code: 'SIDECAR_PROTOCOL_ERROR' });
    f.proc.stdout.write(line + '\n'); await failed; expect(f.onClosed).toHaveBeenCalledOnce();
  });
  it('UTF-8 inválido y línea sobredimensionada se rechazan sin retener/loguear contenido', async () => {
    const f = transport(); f.proc.stdout.write(Buffer.from([0xff, 10])); await expect(f.started).rejects.toMatchObject({ code: 'SIDECAR_PROTOCOL_ERROR' });
    const g = transport(); g.proc.stdout.write(Buffer.alloc(SIDECAR_MAX_LINE_BYTES + 1, 0x41)); await expect(g.started).rejects.toMatchObject({ code: 'SIDECAR_PROTOCOL_ERROR' });
  });
  it('stop es idempotente, rechaza pendientes y tolera error tardío hasta close', async () => {
    const f = transport(); f.ready(4); await f.started;
    const failed = expect(f.connection.request('ping', {}, 1000)).rejects.toMatchObject({ code: 'SIDECAR_STOPPED' });
    const first = f.connection.stop(); expect(f.connection.stop()).toBe(first); await first; await failed;
    expect(() => f.proc.emit('error', new Error('error-tardío'))).not.toThrow(); f.proc.emit('close', 0);
    expect(f.onClosed).toHaveBeenCalledOnce(); expect(f.proc.listenerCount('error')).toBe(0);
  });
  it('start no acredita como lista una conexión que ya se cerró', async () => {
    const f = transport(); f.ready(4); await f.started; await f.connection.stop();
    await expect(f.connection.start()).rejects.toMatchObject({ code: 'SIDECAR_STOPPED' });
  });
  it('un write síncrono fallido retira la generación sin exponer el error crudo', async () => {
    const f = transport(); f.ready(4); await f.started;
    vi.spyOn(f.proc.stdin, 'write').mockImplementationOnce(() => { throw new Error('secreto-ficticio'); });
    expect(f.connection.notify('meeting_audio', {})).toBe(false); expect(f.connection.running).toBe(false);
    expect(f.onClosed).toHaveBeenCalledWith(expect.objectContaining({ code: 'SIDECAR_WRITE_FAILED' }), false);
    expect(f.onClosed.mock.calls[0][0].message).not.toContain('secreto-ficticio');
  });
  it('kill rechazado durante fallo de protocolo produce cierre no confirmado y conserva guardas', async () => {
    const f = transport(); f.proc.kill.mockReturnValueOnce(false); f.proc.stdout.write('no-json\n');
    await expect(f.started).rejects.toMatchObject({ code: 'SIDECAR_STOP_UNCONFIRMED' });
    expect(f.onClosed).toHaveBeenCalledWith(expect.objectContaining({ code: 'SIDECAR_STOP_UNCONFIRMED' }), false);
    f.proc.emit('close', 0); await expect(f.connection.closed).resolves.toBeUndefined();
  });
  it('framing conserva UTF-8 fragmentado y cuenta cuota en bytes, no caracteres', () => {
    const framing = new BoundedNdjson(4), lines: string[] = [];
    for (const byte of Buffer.from('áñ\n')) framing.push(Buffer.from([byte]), text => { lines.push(text); return true; });
    expect(lines).toEqual(['áñ']); expect(() => framing.push(Buffer.from('áñx'), () => true)).toThrow();
  });
});
