import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { zoomRuntimePath } from '../main/zoom-protocol';
describe('recursos aislados de Meeting SDK', () => {
  it('sirve únicamente documento y assets compilados sin acceder a rutas externas', () => {
    const root = path.resolve('dist/zoom-runtime');
    expect(zoomRuntimePath(root, 'soflia-zoom://meeting/index.html')).toBe(path.join(root, 'index.html'));
    expect(zoomRuntimePath(root, 'soflia-zoom://meeting/assets/runtime-123.js')).toBe(path.join(root, 'assets/runtime-123.js'));
    for (const url of ['https://meeting/index.html', 'soflia-zoom://other/index.html', 'soflia-zoom://meeting/%2e%2e%2f.env', 'soflia-zoom://meeting/assets/..%2fsecret.js', 'soflia-zoom://meeting/assets/file.json']) expect(zoomRuntimePath(root, url)).toBeNull();
  });
});
