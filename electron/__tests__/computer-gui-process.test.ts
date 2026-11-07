import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { spawn } from 'node:child_process';
import { runGuiCommand, GUI_PROCESS_MS, GUI_PROCESS_OUTPUT_BYTES } from '../computer-use/gui/process';
import { guiProcessFixture } from './helpers/gui-process.fixture';
vi.mock('node:child_process', () => ({ spawn: vi.fn() }));
let fake: ReturnType<typeof guiProcessFixture>;
beforeEach(() => { fake = guiProcessFixture(); vi.mocked(spawn).mockImplementation(() => fake.child as unknown as ReturnType<typeof spawn>); });
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); vi.useRealTimers(); });
const command = { file: 'ejecutable-ficticio', args: ['argumento'], input: 'texto-ficticio' };
describe('Proceso GUI acotado sin shell', () => {
  it('escribe datos por stdin y sólo confirma al cerrar con código cero', async () => {
    let done = false; const pending = runGuiCommand(command).then(() => { done = true; });
    expect(fake.input()).toBe(command.input); await Promise.resolve(); expect(done).toBe(false);
    fake.close(); await pending; expect(done).toBe(true);
    expect(spawn).toHaveBeenCalledWith(command.file, command.args, expect.objectContaining({ shell: false, windowsHide: true }));
  });
  it.each(['abort', 'timeout', 'stdout', 'stderr'] as const)('retiene trabajo hasta cierre tras %s', async reason => {
    vi.useFakeTimers(); const controller = new AbortController(); let settled = false;
    const pending = runGuiCommand(command, { signal: controller.signal }).finally(() => { settled = true; });
    const rejected = expect(pending).rejects.toThrow('No se completó');
    if (reason === 'abort') controller.abort();
    if (reason === 'timeout') await vi.advanceTimersByTimeAsync(GUI_PROCESS_MS);
    if (reason === 'stdout' || reason === 'stderr') fake.child[reason].emit('data', Buffer.alloc(GUI_PROCESS_OUTPUT_BYTES + 1));
    await Promise.resolve(); expect(fake.child.kill).toHaveBeenCalled(); expect(settled).toBe(false);
    fake.close(null, 'SIGTERM'); await rejected; expect(settled).toBe(true);
  });
  it('cuenta salida conjunta de stdout/stderr, sin guardar contenido', async () => {
    const pending = runGuiCommand(command); const rejected = expect(pending).rejects.toMatchObject({ code: 'GUI_OUTPUT_LIMIT' });
    fake.child.stdout.emit('data', Buffer.alloc(GUI_PROCESS_OUTPUT_BYTES / 2)); fake.child.stderr.emit('data', Buffer.alloc(GUI_PROCESS_OUTPUT_BYTES / 2 + 1));
    fake.close(); await rejected;
  });
  it.each(['spawn', 'exit', 'stdin'] as const)('fallo %s no refleja excepción privada', async reason => {
    if (reason === 'spawn') vi.mocked(spawn).mockImplementationOnce(() => { throw new Error('secreto-ficticio'); });
    const pending = runGuiCommand(command); const rejected = expect(pending).rejects.not.toThrow('secreto-ficticio');
    if (reason === 'stdin') fake.child.stdin.emit('error', new Error('secreto-ficticio'));
    if (reason !== 'spawn') fake.close(1); await rejected;
  });
  it('sin autoridad o ya abortado nunca inicia hijo', async () => {
    await expect(runGuiCommand(command, { signal: AbortSignal.abort() })).rejects.toThrow();
    await expect(runGuiCommand(command, { assertCurrent: () => { throw new Error('denegado'); } })).rejects.toThrow();
    expect(spawn).not.toHaveBeenCalled();
  });
  it('un fallo asíncrono espera close y no filtra error del sistema', async () => {
    const pending = runGuiCommand(command); const rejected = expect(pending).rejects.toMatchObject({ code: 'GUI_UNAVAILABLE' });
    fake.child.emit('error', new Error('ruta-privada-ficticia')); fake.close(-1); await rejected;
  });
});
