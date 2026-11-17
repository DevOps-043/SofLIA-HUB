import { afterEach, describe, expect, it, vi } from 'vitest';
import { AutoBackupService } from '../services/auto-backup-service';

const DAY = 86400000;
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('Planificación de respaldos sin desbordamiento ni solapamiento', () => {
  it('inicios concurrentes conservan un solo timer y stop es idempotente', async () => {
    vi.useFakeTimers();
    const service = new AutoBackupService({ sourceDirs: [], outputDir: 'tmp' });
    const stopped = vi.fn();
    service.on('stopped', stopped);
    await Promise.all([service.start(), service.start()]);
    expect(vi.getTimerCount()).toBe(1);
    await service.stop();
    await service.stop();
    expect(stopped).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('espera treinta días y cancela el siguiente respaldo al detenerse', async () => {
    vi.useFakeTimers();
    const service = new AutoBackupService({ sourceDirs: [], outputDir: 'tmp', intervalDays: 30 });
    const backup = vi.spyOn(service, 'createBackup').mockResolvedValue();
    await service.start();
    await vi.advanceTimersByTimeAsync(25 * DAY);
    expect(backup).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(5 * DAY);
    expect(backup).toHaveBeenCalledTimes(1);
    await service.stop();
    await vi.advanceTimersByTimeAsync(31 * DAY);
    expect(backup).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('no solapa trabajo lento ni reactiva el timer tras stop durante el respaldo', async () => {
    vi.useFakeTimers();
    let complete!: () => void;
    const service = new AutoBackupService({ sourceDirs: [], outputDir: 'tmp', intervalDays: 1 });
    const backup = vi.spyOn(service, 'createBackup').mockImplementation(() => new Promise<void>(resolve => { complete = resolve; }));
    await service.start();
    await vi.advanceTimersByTimeAsync(4 * DAY);
    expect(backup).toHaveBeenCalledTimes(1);
    await service.stop();
    complete();
    await vi.advanceTimersByTimeAsync(4 * DAY);
    expect(backup).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('contiene errores sin listeners y continúa la programación', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const service = new AutoBackupService({ sourceDirs: [], outputDir: 'tmp', intervalDays: 1 });
    const backup = vi.spyOn(service, 'createBackup').mockRejectedValue(new Error('Disco no disponible'));
    await service.start();
    await vi.advanceTimersByTimeAsync(2 * DAY);
    expect(backup).toHaveBeenCalledTimes(2);
    await service.stop();
  });

  it.each([0, -1, NaN, Infinity, Number.MAX_VALUE])('rechaza intervalos inválidos: %s', days => {
    expect(() => new AutoBackupService({ sourceDirs: [], outputDir: 'tmp', intervalDays: days })).toThrow();
    const service = new AutoBackupService({ sourceDirs: [], outputDir: 'tmp' });
    expect(() => service.updateInterval(days)).toThrow();
  });
});
