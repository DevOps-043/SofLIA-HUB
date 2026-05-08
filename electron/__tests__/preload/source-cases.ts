import { expect, it } from 'vitest';
import { CSP_CONTENT, preloadSource } from './helpers';

export function registerPreloadSourceTests() {
  it('SEC-026: CSP policy in source blocks unsafe-eval', () => {
    expect(CSP_CONTENT).toContain("script-src 'self'");
    expect(CSP_CONTENT).not.toContain('unsafe-eval');
  });

  it('SEC-027: CSP allows WebSocket connections', () => {
    expect(preloadSource).toContain('ws:');
    expect(preloadSource).toContain('wss:');
  });

  it('SEC-028: contextIsolation check present in source', () => {
    expect(preloadSource).toContain('process.contextIsolated');
    expect(preloadSource).toContain('contextIsolation no esta habilitado');
  });

  it('SEC-029: contextBridge.exposeInMainWorld called in source', () => {
    const exposeCount = (preloadSource.match(/(?:contextBridge|bridge)\.exposeInMainWorld/g) || []).length;
    expect(exposeCount).toBeGreaterThanOrEqual(3);
  });
}
