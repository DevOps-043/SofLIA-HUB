import { describe, it, expect, vi } from 'vitest';
import { processPreparedMeetingRun } from '../meetings/meeting-workflow/run-processor';
type Dependencies = Parameters<typeof processPreparedMeetingRun>[0];
describe('Borrador multiagente y cambio de sesión', () => {
  it('no inicia una escritura después de perder la sesión durante una lectura', async () => {
    let valid = true;
    const store = {
      findRunByOwnerAndSourceHash: vi.fn(async () => { valid = false; return null; }),
      getNextSourceVersion: vi.fn(), createRun: vi.fn(),
    };
    const deps = {
      input: { ownerUserId: 'lia-usuario', originChannel: 'app' }, source: { content_hash: 'hash' },
      store, executionGuard: () => { if (!valid) throw new Error('Sesión revocada'); },
    } as unknown as Dependencies;
    await expect(processPreparedMeetingRun(deps)).rejects.toThrow('revocada');
    expect(store.createRun).not.toHaveBeenCalled();
    expect(store.getNextSourceVersion).not.toHaveBeenCalled();
  });
  it('detiene etapas posteriores cuando ya existe un efecto parcial', async () => {
    let valid = true;
    const store = {
      findRunByOwnerAndSourceHash: vi.fn(async () => null),
      getNextSourceVersion: vi.fn(async () => 1),
      createRun: vi.fn(async () => { valid = false; return { id: 'mrun-1' }; }),
      addSourceArtifact: vi.fn(), updateRunStatus: vi.fn(),
    };
    const deps = {
      input: { ownerUserId: 'lia-usuario', originChannel: 'app' }, source: { content_hash: 'hash' },
      store, createTraceId: () => 'trace', executionGuard: () => { if (!valid) throw new Error('Sesión revocada'); },
    } as unknown as Dependencies;
    await expect(processPreparedMeetingRun(deps)).rejects.toThrow('revocada');
    expect(store.createRun).toHaveBeenCalledTimes(1);
    expect(store.addSourceArtifact).not.toHaveBeenCalled();
    expect(store.updateRunStatus).not.toHaveBeenCalled();
  });
});
