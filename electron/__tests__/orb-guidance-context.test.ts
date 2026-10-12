import { describe, expect, it, vi } from 'vitest';
import { captureDesktopContextGuard } from '../orb-guidance/desktop-context';
import type { DesktopAgentService } from '../desktop-agent-service';

describe('identidad de ventana durante una indicación', () => {
  it.each(['handle', 'bounds'] as const)('rechaza un cambio de %s antes del clic', async kind => {
    const before = { id: 1, ok: true, cmd: 'foreground', handle: '100', rect: { x: 0, y: 0, width: 800, height: 600 } };
    const after = kind === 'handle' ? { ...before, handle: '200' } : { ...before, rect: { ...before.rect, x: 20 } };
    const send = vi.fn().mockResolvedValueOnce(before).mockResolvedValueOnce(after);
    const service = { config: { uiaWorkerEnabled: true }, visualGuidance: {}, uiaWorker: { send } } as unknown as DesktopAgentService;
    const guard = await captureDesktopContextGuard(service);
    if (process.platform === 'win32') await expect(guard()).rejects.toThrow('ventana objetivo cambió');
    else await guard();
  });
});
