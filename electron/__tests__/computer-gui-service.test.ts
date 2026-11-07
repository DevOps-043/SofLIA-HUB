import './computer-use-handlers.mocks';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { spawn } from 'node:child_process';
import { handleUseComputer } from '../computer-use/gui-tool';
import { executeToolDirect } from '../computer-use/tool-dispatch';
import { handleTakeScreenshot } from '../computer-use/screenshot-tool';
import { findTextCoordinates } from '../computer-use/ocr-targeting';
import { resetAuthStateForTests, setAuthState } from '../main/auth-state';
import { guiProcessFixture } from './helpers/gui-process.fixture';
import { GUI_OPERATION_MS } from '../computer-use/gui/execution-context';
vi.mock('../computer-use/screenshot-tool', () => ({ handleTakeScreenshot: vi.fn(), handleListScreens: vi.fn() }));
vi.mock('../computer-use/ocr-targeting', () => ({ findTextCoordinates: vi.fn() }));
const capture = { success: true, image: 'data:image/png;base64,aW1hZ2VuLWZpY3RpY2lh' };
let fake: ReturnType<typeof guiProcessFixture>;
beforeEach(() => {
  vi.clearAllMocks(); resetAuthStateForTests(); setAuthState({ authenticated: true, userId: 'usuario-qa' });
  fake = guiProcessFixture();
  vi.mocked(spawn).mockImplementation(() => { queueMicrotask(() => fake.close()); return fake.child as unknown as ReturnType<typeof spawn>; });
  vi.mocked(handleTakeScreenshot).mockResolvedValue(capture);
  vi.mocked(findTextCoordinates).mockResolvedValue({ x: 10, y: 20, confidence: 90 });
});
afterEach(() => { resetAuthStateForTests(); vi.restoreAllMocks(); vi.useRealTimers(); });
describe('Lease de GUI y dispatcher integrados', () => {
  it('dispatcher conserva texto, proceso fijo y captura final con servicio real', async () => {
    expect(await executeToolDirect('use_computer', { action: 'type', text: 'texto +%{} ficticio' })).toMatchObject({ success: true });
    expect(spawn).toHaveBeenCalledOnce(); expect(vi.mocked(spawn).mock.calls[0][2]).toMatchObject({ shell: false, windowsHide: true });
    expect(handleTakeScreenshot).toHaveBeenCalledOnce();
  });
  it('screenshot conserva función sin lanzar entrada al SO', async () => {
    expect(await handleUseComputer({ action: 'screenshot' })).toMatchObject({ success: true }); expect(spawn).not.toHaveBeenCalled();
  });
  it.each([{ success: false, error: 'secreto-ficticio' }, { success: true }])('captura fallida o incompleta se devuelve sin detalle privado %#', async result => {
    vi.mocked(handleTakeScreenshot).mockResolvedValueOnce(result);
    const reply = await handleUseComputer({ action: 'screenshot' });
    expect(reply.success).toBe(false); expect(JSON.stringify(reply)).not.toContain('secreto-ficticio'); expect(spawn).not.toHaveBeenCalled();
  });
  it('ausencia de sesión y payload inválido no capturan ni ejecutan', async () => {
    expect(await handleUseComputer({ action: 'type', text: '\0' })).toMatchObject({ success: false });
    resetAuthStateForTests(); expect(await handleUseComputer({ action: 'type', text: 'texto' })).toMatchObject({ success: false });
    expect(spawn).not.toHaveBeenCalled(); expect(handleTakeScreenshot).not.toHaveBeenCalled();
  });
  it.each(['sesión', 'A/B/A', 'fuente'] as const)('revoca durante OCR: %s', async reason => {
    const controller = new AbortController();
    vi.mocked(findTextCoordinates).mockImplementationOnce(async () => {
      if (reason === 'sesión') setAuthState({ authenticated: false, userId: null });
      if (reason === 'A/B/A') { setAuthState({ authenticated: true, userId: 'otra' }); setAuthState({ authenticated: true, userId: 'usuario-qa' }); }
      if (reason === 'fuente') controller.abort();
      return { x: 10, y: 20, confidence: 90 };
    });
    expect(await executeToolDirect('use_computer', { action: 'left_click', text: 'objetivo' }, undefined, { signal: controller.signal })).toMatchObject({ success: false });
    expect(spawn).not.toHaveBeenCalled(); expect(handleTakeScreenshot).toHaveBeenCalledOnce();
  });
  it('revocar durante captura no inicia OCR ni captura de error', async () => {
    vi.mocked(handleTakeScreenshot).mockImplementationOnce(async () => { setAuthState({ authenticated: false, userId: null }); return capture; });
    expect(await handleUseComputer({ action: 'left_click', text: 'objetivo' })).toMatchObject({ success: false });
    expect(findTextCoordinates).not.toHaveBeenCalled(); expect(handleTakeScreenshot).toHaveBeenCalledOnce(); expect(spawn).not.toHaveBeenCalled();
  });
  it('OCR fallido no genera captura adicional ni muestra error privado', async () => {
    vi.mocked(findTextCoordinates).mockRejectedValueOnce(new Error('secreto-ficticio'));
    const reply = await handleUseComputer({ action: 'left_click', text: 'objetivo' });
    expect(JSON.stringify(reply)).not.toContain('secreto-ficticio'); expect(reply.success).toBe(false);
    expect(handleTakeScreenshot).toHaveBeenCalledOnce(); expect(spawn).not.toHaveBeenCalled();
  });
  it('un proceso revocado conserva exclusión hasta cierre físico', async () => {
    vi.mocked(spawn).mockImplementationOnce(() => fake.child as unknown as ReturnType<typeof spawn>);
    const pending = handleUseComputer({ action: 'type', text: 'texto' });
    await vi.waitFor(() => expect(spawn).toHaveBeenCalledOnce()); setAuthState({ authenticated: true, userId: 'otra' });
    expect(fake.child.kill).toHaveBeenCalled();
    expect(await handleUseComputer({ action: 'screenshot' })).toMatchObject({ code: 'GUI_BUSY' });
    fake.close(); expect(await pending).toMatchObject({ success: false }); expect(handleTakeScreenshot).not.toHaveBeenCalled();
    expect(await handleUseComputer({ action: 'screenshot' })).toMatchObject({ success: true });
  });
  it('deadline durante creación/OCR no admite entrada tardía', async () => {
    vi.useFakeTimers(); let finish!: (value: { x: number; y: number; confidence: number }) => void;
    vi.mocked(findTextCoordinates).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = handleUseComputer({ action: 'left_click', text: 'objetivo' });
    await vi.advanceTimersByTimeAsync(GUI_OPERATION_MS); finish({ x: 10, y: 20, confidence: 90 });
    expect(await pending).toMatchObject({ success: false }); expect(spawn).not.toHaveBeenCalled();
  });
});
