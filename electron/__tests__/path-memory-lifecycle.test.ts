import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PathMemoryService } from '../path-memory-service';
import type { setupPathWatchers } from '../path-memory/watchers';
const mocks = vi.hoisted(() => ({ scan: vi.fn(), write: vi.fn(), setup: vi.fn(), stop: vi.fn(),
  options: null as Parameters<typeof setupPathWatchers>[0] | null }));
vi.mock('node:fs', () => ({ existsSync: () => true }));
vi.mock('node:fs/promises', () => ({ mkdir: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../path-memory/key-paths', () => ({ resolveKeyPaths: async () => new Map([['Documentos', 'fixture']]) }));
vi.mock('../path-memory/scanner', () => ({ scanDirectory: mocks.scan }));
vi.mock('../path-memory/write-paths', () => ({ writePathsMarkdownFile: mocks.write }));
vi.mock('../path-memory/changed-dirs', () => ({ markChangedKeyDirs: async (_paths: unknown, _dirs: unknown, changed: Set<string>) => { changed.add('fixture'); } }));
vi.mock('../path-memory/watchers', () => ({ setupPathWatchers: (options: Parameters<typeof setupPathWatchers>[0]) => { mocks.setup(); mocks.options = options; }, stopPathWatchers: mocks.stop }));
const tracked: PathMemoryService[] = [];
beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); mocks.scan.mockReset().mockResolvedValue(undefined); mocks.write.mockReset().mockResolvedValue({ size: 10, dirs: 1 }); });
afterEach(() => { tracked.splice(0).forEach(service => service.stop()); vi.useRealTimers(); });
function create() { const service = new PathMemoryService(); tracked.push(service); return service; }
describe('Actualización única del índice de rutas', () => {
  it('recupera una invalidación llegada entre completar el trabajo y liberar la promesa', async () => {
    const service = create();
    service.once('updated', () => {
      queueMicrotask(() => queueMicrotask(() => queueMicrotask(() => {
        mocks.options!.changedDirs.add('fixture'); mocks.options!.onChanged();
      })));
    });
    await service.init(); service.start(); await vi.advanceTimersByTimeAsync(1);
    expect(mocks.scan).toHaveBeenCalledTimes(2);
  });

  it('start repetido conserva un intervalo y una instalación de watchers', async () => {
    const service = create(); await service.init(); service.start(); service.start(); service.start();
    await vi.advanceTimersByTimeAsync(1);
    expect(mocks.setup).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(1);
    service.stop(); expect(vi.getTimerCount()).toBe(0);
  });
  it('cien eventos durante un escaneo lento se recuperan con una actualización posterior', async () => {
    let finish!: () => void;
    mocks.scan.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
    const service = create(); await service.init(); service.start(); await vi.advanceTimersByTimeAsync(1);
    for (let index = 0; index < 100; index++) { mocks.options!.changedDirs.add('fixture'); mocks.options!.onChanged(); }
    await vi.advanceTimersByTimeAsync(45 * 60000);
    expect(mocks.scan).toHaveBeenCalledTimes(1);
    finish(); await vi.advanceTimersByTimeAsync(1);
    expect(mocks.scan).toHaveBeenCalledTimes(2); expect(mocks.write).toHaveBeenCalledTimes(2);
  });
  it('stop durante escritura impide emitir datos antiguos y permite reiniciar', async () => {
    let finish!: (value: { size: number; dirs: number }) => void;
    mocks.write.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const service = create(), updated = vi.fn(); service.on('updated', updated);
    await service.init(); service.start(); await vi.advanceTimersByTimeAsync(1);
    service.stop(); finish({ size: 10, dirs: 1 }); await vi.advanceTimersByTimeAsync(1);
    expect(updated).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
    service.start(); await vi.advanceTimersByTimeAsync(1);
    expect(updated).toHaveBeenCalledTimes(1);
  });
});
