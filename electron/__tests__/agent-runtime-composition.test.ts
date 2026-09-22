import { describe, it, expect, vi } from 'vitest';
import { AgentRuntime } from '../agent-runtime/runtime';
import type { CreateMeetingRunResult } from '../meetings/meeting-types';
vi.mock('../agent-runtime/gemini-provider', () => ({
  GeminiAgentProvider: class {
    async execute() { return { text: 'Minuta revisable con evidencia L1.', inputTokens: 1, outputTokens: 1 }; }
  },
}));
function fixture() {
  let userId: string | null = 'sofia-a';
  let ownerId: string | null = 'lia-a';
  const authorize = vi.fn(async () => {});
  const createManualRun = vi.fn(async () => ({ detail: { run: { id: 'mrun-a' } } } as CreateMeetingRunResult));
  const runtime = new AgentRuntime({
    root: '/no-escribir-en-modo-volatil',
    cipher: { isEncryptionAvailable: () => false, encryptString: () => { throw new Error(); }, decryptString: () => { throw new Error(); } },
    getUserId: () => userId, getMeetingOwnerId: () => ownerId, authorize,
    geminiKey: () => 'clave-simulada', meetings: { createManualRun },
  });
  return { runtime, authorize, createManualRun, setUser: (id: string | null) => { userId = id; }, setOwner: (id: string | null) => { ownerId = id; } };
}
describe('Composición e identidades del arnés', () => {
  it('persiste el borrador con el usuario Lia y vigila ambas identidades', async () => {
    const { runtime, createManualRun, setOwner } = fixture();
    await runtime.setContext(null);
    const started = await runtime.harness.start({ title: 'Reunión', source: 'Acuerdo fuente verificable.', provider: 'gemini' });
    await vi.waitFor(() => expect(runtime.state().runs[0].status).toBe('review'));
    const run = runtime.state().runs[0];
    await runtime.harness.publish(started.id, run.digest!);
    const invocation = createManualRun.mock.calls[0] as unknown as [Record<string, unknown>, () => void];
    expect(invocation[0].ownerUserId).toBe('lia-a');
    expect(invocation[0].organizationId).toBeNull();
    expect(() => invocation[1]()).not.toThrow();
    setOwner('lia-b');
    expect(() => invocation[1]()).toThrow('sesión');
    runtime.harness.close();
  });
  it('rechaza un contexto no autorizado sin conservar acceso al anterior', async () => {
    const { runtime, authorize } = fixture();
    await runtime.setContext(null);
    authorize.mockRejectedValueOnce(new Error('Membresía ausente'));
    await expect(runtime.setContext('otra-organizacion')).rejects.toThrow();
    expect(() => runtime.state()).toThrow();
    runtime.harness.close();
  });
  it('descarta la apertura tardía de un ámbito revocado', async () => {
    const { runtime, authorize } = fixture();
    let resolve!: () => void;
    authorize.mockImplementationOnce(() => new Promise<void>(done => { resolve = done; }));
    const opening = runtime.setContext(null);
    runtime.invalidate();
    resolve();
    await expect(opening).rejects.toThrow('contexto');
    expect(() => runtime.requireContext()).toThrow();
    runtime.harness.close();
  });
  it('impide crear borrador sin identidad Lia', async () => {
    const { runtime, setOwner, createManualRun } = fixture();
    await runtime.setContext(null);
    await runtime.harness.start({ title: 'Reunión', source: 'Acuerdo fuente verificable.', provider: 'gemini' });
    await vi.waitFor(() => expect(runtime.state().runs[0].status).toBe('review'));
    const run = runtime.state().runs[0];
    setOwner(null);
    expect((await runtime.harness.publish(run.id, run.digest!)).status).toBe('uncertain');
    expect(createManualRun).not.toHaveBeenCalled();
    runtime.harness.close();
  });
});
