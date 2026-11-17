import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { scanDirectory } from '../path-memory/scanner';
import { setupPathWatchers, stopPathWatchers } from '../path-memory/watchers';
import type { ScannedDir } from '../path-memory/types';
const mocks = vi.hoisted(() => ({ readdir: vi.fn(), stat: vi.fn(), watch: vi.fn() }));
vi.mock('node:fs/promises', () => ({ readdir: mocks.readdir, stat: mocks.stat }));
vi.mock('node:fs', () => ({ watch: mocks.watch }));
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
const files = (count: number) => Array.from({ length: count }, (_, index) => ({ name: `archivo-${index}`, isDirectory: () => false }));

describe('Escaneo con metadatos paralelos acotados', () => {
  it('resuelve veinte archivos en cinco tandas sin superar cuatro consultas', async () => {
    vi.useFakeTimers();
    mocks.readdir.mockResolvedValue(files(20));
    let active = 0, peak = 0;
    mocks.stat.mockReset().mockImplementation(async () => {
      active++; peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, 10)); active--;
      return { size: 1, mtimeMs: 1 };
    });
    const dirs = new Map<string, ScannedDir>();
    const operation = scanDirectory(dirs, 'fixture', 'Documentos', 0);
    await vi.advanceTimersByTimeAsync(50); await operation;
    expect(peak).toBe(4); expect(mocks.stat).toHaveBeenCalledTimes(20);
    expect([...dirs.values()][0].entries).toHaveLength(20);
    expect(active).toBe(0);
  });

  it('cancelar una tanda evita consultar las restantes y publicar un mapa parcial', async () => {
    let finish!: () => void, current = true;
    const wait = new Promise<void>(resolve => { finish = resolve; });
    mocks.readdir.mockResolvedValue(files(20));
    mocks.stat.mockReset().mockImplementation(async () => { await wait; return { size: 1, mtimeMs: 1 }; });
    const dirs = new Map<string, ScannedDir>();
    const operation = scanDirectory(dirs, 'fixture', '', 0, 0, () => current);
    await vi.waitFor(() => expect(mocks.stat).toHaveBeenCalledTimes(4));
    current = false; finish(); await operation;
    expect(mocks.stat).toHaveBeenCalledTimes(4); expect(dirs.size).toBe(0);
  });

  it('conserva el tope de doscientas entradas y orden estable con fechas iguales', async () => {
    mocks.readdir.mockResolvedValue(files(205));
    mocks.stat.mockReset().mockResolvedValue({ size: 1, mtimeMs: 1 });
    const dirs = new Map<string, ScannedDir>(); await scanDirectory(dirs, 'fixture', '', 0);
    const entries = [...dirs.values()][0].entries;
    expect(entries).toHaveLength(200); expect(mocks.stat).toHaveBeenCalledTimes(200);
    expect(entries.map(entry => entry.name)).toEqual(files(200).map(entry => entry.name));
  });

  it('contiene errores de watcher y evita timers nuevos después de detenerse', () => {
    vi.useFakeTimers(); vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const watcher = Object.assign(new EventEmitter(), { close: vi.fn() });
    mocks.watch.mockReset().mockReturnValue(watcher);
    let active = true;
    const options: Parameters<typeof setupPathWatchers>[0] = { keyPaths: new Map([['Documentos', 'fixture']]), watchers: [], timers: new Map(), changedDirs: new Set(), onChanged: vi.fn(), isActive: () => active };
    setupPathWatchers(options);
    expect(() => watcher.emit('error', new Error('Carpeta retirada'))).not.toThrow();
    active = false; stopPathWatchers(options.watchers);
    mocks.watch.mock.calls[0][2]();
    expect(vi.getTimerCount()).toBe(0); expect(watcher.close).toHaveBeenCalledOnce();
  });
});
