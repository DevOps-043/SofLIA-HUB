import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }));

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return { ...actual, spawn: spawnMock };
});

const { PythonRuntimeService } = await import('../python-runtime-service');

/** Hijo minimo con la superficie que consume el servicio (stdio + eventos). */
function createFakeChild() {
  const child = new EventEmitter() as EventEmitter & Record<string, unknown>;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.stdin = new PassThrough();
  child.kill = vi.fn();
  child.killed = false;
  return child;
}

describe('PythonRuntimeService arranque sin runtime', () => {
  beforeEach(() => {
    spawnMock.mockReset();
  });

  it('RUNTIME-GUARD-1: sin runtime instalado no se spawnea y el error explica el remedio', async () => {
    // app.getAppPath() apunta a un directorio de prueba sin python-runtime.
    const service = new PythonRuntimeService();

    const result = await service.listMicDevices();

    expect(spawnMock).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.error).toContain('python:setup');
    const status = service.getStatus();
    expect(status.runtimeAvailable).toBe(false);
    expect(status.sidecarRunning).toBe(false);
    expect(status.lastError).toContain('python:setup');
  });

  it('RUNTIME-GUARD-2: un spawn fallido se degrada a error y NO tumba el proceso main', async () => {
    const service = new PythonRuntimeService();
    // Se salta la comprobacion de ficheros para ejercitar el fallo asincrono de
    // spawn, que es el que emitia 'error' sin listener y mataba el main.
    vi.spyOn(service as unknown as { assertRuntimeAvailable: () => void }, 'assertRuntimeAvailable')
      .mockImplementation(() => undefined);
    const child = createFakeChild();
    spawnMock.mockReturnValue(child);

    const pending = service.listMicDevices();
    await Promise.resolve();
    // Sin la guarda, este emit se propagaba como excepcion no capturada.
    expect(() => child.emit('error', new Error('spawn python.exe ENOENT'))).not.toThrow();

    const result = await pending;
    expect(result.success).toBe(false);
    expect(result.error).toContain('No se pudo lanzar el sidecar Python');
    expect(result.error).toContain('ENOENT');
    expect(service.getStatus().sidecarRunning).toBe(false);
    expect(service.getStatus().lastError).toContain('ENOENT');
  });

  it('RUNTIME-GUARD-3: la escucha pasiva reporta el fallo en vez de propagarlo', async () => {
    const service = new PythonRuntimeService();
    vi.spyOn(service as unknown as { resolveWakeModelPath: () => string | null }, 'resolveWakeModelPath')
      .mockReturnValue('C:\\models\\vosk-small');

    const result = await service.startPassiveListening();

    expect(spawnMock).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.error).toContain('python:setup');
    expect(service.getStatus().listening).toBe(false);
  });
});
