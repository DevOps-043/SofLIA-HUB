import { describe, it, expect, vi } from 'vitest';
import { desktopCapturer } from 'electron';
import { executeToolDirect } from './context';

describe('Screenshots and processes', () => {
  it('CU-075: take_screenshot captures screen', async () => {
    vi.mocked(desktopCapturer.getSources).mockResolvedValue([{
      id: 'screen:0:0',
      name: 'Screen 1',
      display_id: '0',
      thumbnail: { toDataURL: () => 'data:image/png;base64,iVBOR' },
      appIcon: null,
    }] as any);
    const result = await executeToolDirect('take_screenshot', {});
    expect(result.success).toBe(true);
    expect(result.image).toContain('data:image/png;base64');
  });

  it('CU-076: take_screenshot uses configured quality/dimensions', async () => {
    vi.mocked(desktopCapturer.getSources).mockResolvedValue([{
      id: 'screen:0:0', name: 'Screen', display_id: '0',
      thumbnail: { toDataURL: () => 'data:image/png;base64,abc' },
      appIcon: null,
    }] as any);
    const result = await executeToolDirect('take_screenshot', { width: 800, height: 600 });
    expect(result.success).toBe(true);
    expect(desktopCapturer.getSources).toHaveBeenCalledWith(
      expect.objectContaining({ thumbnailSize: { width: 800, height: 600 } }),
    );
  });

  it('CU-077: take_screenshot handles multi-monitor with display_id', async () => {
    vi.mocked(desktopCapturer.getSources).mockResolvedValue([
      { id: 'screen:0:0', name: 'Main', display_id: '0', thumbnail: { toDataURL: () => 'main-img' }, appIcon: null },
      { id: 'screen:1:0', name: 'Secondary', display_id: '1', thumbnail: { toDataURL: () => 'sec-img' }, appIcon: null },
    ] as any);
    const result = await executeToolDirect('take_screenshot', { display_id: '1' });
    expect(result.success).toBe(true);
    expect(result.image).toBe('sec-img');
  });

  it('CU-078: take_screenshot returns error when no displays', async () => {
    vi.mocked(desktopCapturer.getSources).mockResolvedValue([]);
    const result = await executeToolDirect('take_screenshot', {});
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no se encontraron/i);
  });

  it('CU-079: list_processes returns process list', async () => {
    const result = await executeToolDirect('list_processes', {});
    expect(result.success).toBe(true);
    expect(result.processes).toBeDefined();
    expect(result.processes.length).toBeGreaterThan(0);
    expect(result.processes[0]).toHaveProperty('pid');
    expect(result.processes[0]).toHaveProperty('name');
    expect(result.processes[0]).toHaveProperty('cpu');
  });

  it('CU-080: kill_process terminates valid PID', async () => {
    const originalKill = process.kill;
    process.kill = vi.fn() as any;
    const result = await executeToolDirect('kill_process', { pid: 9999 });
    expect(result.success).toBe(true);
    expect(process.kill).toHaveBeenCalledWith(9999, 'SIGKILL');
    process.kill = originalKill;
  });

  it('CU-081: kill_process rejects invalid PID', async () => {
    const result = await executeToolDirect('kill_process', { pid: -1 });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/inv.lido/i);
  });

  it('CU-082: kill_process rejects NaN PID', async () => {
    const result = await executeToolDirect('kill_process', { pid: NaN });
    expect(result.success).toBe(false);
  });

  it('CU-083: list_screens returns screen list', async () => {
    vi.mocked(desktopCapturer.getSources).mockResolvedValue([
      { id: 'screen:0:0', name: 'Screen 1', display_id: '0', thumbnail: null, appIcon: null },
    ] as any);
    const result = await executeToolDirect('list_screens', {});
    expect(result.success).toBe(true);
    expect(result.screens).toHaveLength(1);
    expect(result.screens![0]).toHaveProperty('id');
    expect(result.screens![0]).toHaveProperty('name');
  });

  it('CU-084: open_file_on_computer returns error without path', async () => {
    const result = await executeToolDirect('open_file_on_computer', {});
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/ruta/i);
  });
});
