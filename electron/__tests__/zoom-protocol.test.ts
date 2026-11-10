import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { Session } from 'electron';
import { installZoomProtocol, zoomRuntimePath } from '../main/zoom-protocol';

vi.mock('node:fs/promises', () => ({ readFile: vi.fn(async () => Buffer.from('<!doctype html>')) }));
describe('recursos aislados de Meeting SDK', () => {
  it('sirve únicamente documento y assets compilados sin acceder a rutas externas', () => {
    const root = path.resolve('dist/zoom-runtime');
    expect(zoomRuntimePath(root, 'soflia-zoom://meeting/index.html')).toBe(path.join(root, 'index.html'));
    expect(zoomRuntimePath(root, 'soflia-zoom://meeting/assets/runtime-123.js')).toBe(path.join(root, 'assets/runtime-123.js'));
    expect(zoomRuntimePath(root, 'soflia-zoom://meeting/lib/video.simd.wasm')).toBe(path.join(root, 'lib/video.simd.wasm'));
    expect(zoomRuntimePath(root, 'soflia-zoom://meeting/lib/manifest.json')).toBe(path.join(root, 'lib/manifest.json'));
    for (const url of ['soflia-zoom://meeting/lib/..%2fsecret.js', 'soflia-zoom://meeting/lib/file.exe', 'soflia-zoom://meeting/lib/.env', 'soflia-zoom://meeting/lib/video.js?path=secret']) expect(zoomRuntimePath(root, url)).toBeNull();
    for (const url of ['https://meeting/index.html', 'soflia-zoom://other/index.html', 'soflia-zoom://meeting/%2e%2e%2f.env', 'soflia-zoom://meeting/assets/..%2fsecret.js', 'soflia-zoom://meeting/assets/file.json']) expect(zoomRuntimePath(root, url)).toBeNull();
  });

  it('permite el destino de inicialización de Video SDK sin abrir conexiones a cualquier origen', async () => {
    const handle = vi.fn();
    const target = { protocol: { isProtocolHandled: vi.fn(async () => false), handle } } as unknown as Session;
    await installZoomProtocol(target, path.resolve('dist/zoom-runtime'));
    const handler = handle.mock.calls[0][1] as (request: Request) => Promise<Response>;
    const response = await handler(new Request('soflia-zoom://meeting/index.html'));
    expect(response.status).toBe(200);
    const policy = response.headers.get('Content-Security-Policy')!;
    const connections = policy.split(';').map(part => part.trim().split(/\s+/)).find(part => part[0] === 'connect-src')!;
    for (const destination of ['https://zoom.us/wc/lsdk', 'https://zoom.com/wc/lsdk']) {
      expect(connections).toContain(new URL(destination).origin);
    }
    for (const unrestricted of ['*', 'http:', 'https:', 'http://zoom.us', 'https://zoom.us.ejemplo.com']) {
      expect(connections).not.toContain(unrestricted);
    }
    expect(policy).toContain("default-src 'self'");
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });
});
