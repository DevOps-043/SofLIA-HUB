import { beforeEach, describe, expect, it, vi } from 'vitest';
import { collectSnapshot } from '../windows-uia/snapshot';
import type { WindowsUIAServiceCore } from '../windows-uia/core';

const native = vi.hoisted(() => ({ exec: vi.fn() }));
vi.mock('node:child_process', async () => {
  const { promisify } = await import('node:util');
  return { exec: Object.assign(vi.fn(), { [promisify.custom]: native.exec }) };
});
beforeEach(() => { vi.clearAllMocks(); native.exec.mockResolvedValue({ stdout: JSON.stringify({ title: 'Ventana de prueba', process: 'prueba', pid: 12 }) }); });
function fixture() {
  const abort = new AbortController();
  const desktop = { listWindows: vi.fn(async () => []), getUIElements: vi.fn(async () => []), takeScreenshot: vi.fn(async () => '') };
  return { abort, desktop, core: { desktopAgent: desktop } as unknown as WindowsUIAServiceCore };
}
describe('Captura UIA con transporte de proceso sustituido', () => {
  it('el programa no intenta escribir variables automáticas constantes', async () => {
    const f = fixture(); const result = await collectSnapshot(f.core, f.abort.signal);
    expect(result.currentWindowTitle).toBe('Ventana de prueba'); expect(result.currentProcess).toBe('prueba');
    expect(native.exec.mock.calls[0][0]).not.toMatch(/\$(?:pid|home|pshome)\s*=/i);
  });
  it('revocada no inicia el proceso de consulta', async () => {
    const f = fixture(); f.abort.abort(); await expect(collectSnapshot(f.core, f.abort.signal)).rejects.toThrow('cancelada'); expect(native.exec).not.toHaveBeenCalled();
  });
  it('revocar durante consulta no inicia lectura de ventanas', async () => {
    const f = fixture(); native.exec.mockImplementationOnce(async () => { f.abort.abort(); return { stdout: '{}' }; });
    await expect(collectSnapshot(f.core, f.abort.signal)).rejects.toThrow('cancelada'); expect(f.desktop.listWindows).not.toHaveBeenCalled();
  });
  it('revocar durante elementos no inicia screenshot', async () => {
    const f = fixture(); f.desktop.getUIElements.mockImplementationOnce(async () => { f.abort.abort(); return []; });
    await expect(collectSnapshot(f.core, f.abort.signal)).rejects.toThrow('cancelada'); expect(f.desktop.takeScreenshot).not.toHaveBeenCalled();
  });
});
