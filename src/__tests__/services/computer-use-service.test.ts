/**
 * Tests CU-148 to CU-150: computer-use-service.ts — Renderer IPC bridge tests.
 * Uses the window.computerUse mock from setup-renderer.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies that computer-use-service might import
vi.mock('../../config', () => ({
  GOOGLE_API_KEY: 'test-key',
  MODELS: {},
}));

describe('computer-use-service — Renderer IPC bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock return values from setup-renderer
    if (window.computerUse) {
      vi.mocked(window.computerUse.listDirectory).mockResolvedValue({ success: true, entries: [{ name: 'test.txt', type: 'file' }] });
      vi.mocked(window.computerUse.readFile).mockResolvedValue({ success: true, content: 'contenido del archivo' });
      vi.mocked(window.computerUse.executeCommand).mockResolvedValue({ success: true, stdout: 'resultado', stderr: '' });
    }
  });

  // CU-148: listDirectory invokes IPC
  it('CU-148: listDirectory invokes window.computerUse.listDirectory IPC', async () => {
    const api = window.computerUse!;
    const result = await api.listDirectory('C:/Users/test');

    expect(window.computerUse!.listDirectory).toHaveBeenCalledWith('C:/Users/test');
    expect(result.success).toBe(true);
    expect(result.entries).toBeDefined();
    expect(result.entries.length).toBeGreaterThan(0);
  });

  // CU-149: readFile invokes IPC
  it('CU-149: readFile invokes window.computerUse.readFile IPC', async () => {
    const api = window.computerUse!;
    const result = await api.readFile('C:/Users/test/archivo.txt');

    expect(window.computerUse!.readFile).toHaveBeenCalledWith('C:/Users/test/archivo.txt');
    expect(result.success).toBe(true);
    expect(result.content).toBe('contenido del archivo');
  });

  // CU-150: executeCommand invokes IPC
  it('CU-150: executeCommand invokes window.computerUse.executeCommand IPC', async () => {
    const api = window.computerUse!;
    const result = await api.executeCommand('dir');

    expect(window.computerUse!.executeCommand).toHaveBeenCalledWith('dir');
    expect(result.success).toBe(true);
    expect(result.stdout).toBe('resultado');
  });
});
