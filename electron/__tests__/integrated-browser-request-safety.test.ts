import { describe, expect, it, vi } from 'vitest';
import { BrowserRequestSafety } from '../integrated-browser/request-safety';
import type { BrowserNavigationSafetyVerdict, BrowserSafeNavigationOptions } from '../integrated-browser/safe-navigation';

const allow: BrowserNavigationSafetyVerdict = { action: 'allow', source: 'remote', reason: null, checkedAt: '2026-09-08T00:00:00.000Z' };
describe('Reputación de solicitudes sin caché', () => {
  it('una navegación principal cancela los marcos pendientes sin afectar otra pestaña', async () => {
    const release: Array<() => void> = []; const signals: AbortSignal[] = [];
    const check = vi.fn((_url: string, options?: BrowserSafeNavigationOptions) => new Promise<BrowserNavigationSafetyVerdict>((resolve) => {
      signals.push(options!.signal!); release.push(() => resolve(allow));
    }));
    const safety = new BrowserRequestSafety(check); const one = {}, two = {};
    const pending = [safety.review('https://example.com/', one, 'main', () => true), safety.review('https://example.com/', one, 'sub', () => true), safety.review('https://example.com/', two, 'main', () => true)];
    safety.invalidate(one, 'main'); release.forEach((finish) => finish());
    expect(await Promise.all(pending)).toEqual([null, null, allow]);
    expect(signals.map((signal) => signal.aborted)).toEqual([true, true, false]);
  });
  it('no aplica dictámenes después de cerrar la sesión ni al cambiar el documento', async () => {
    let resolve!: (value: BrowserNavigationSafetyVerdict) => void;
    const check = vi.fn(() => new Promise<BrowserNavigationSafetyVerdict>((done) => { resolve = done; }));
    const safety = new BrowserRequestSafety(check); let current = true;
    const first = safety.review('https://example.com/', {}, 'main', () => current);
    current = false; resolve(allow); expect(await first).toBeNull();
    const second = safety.review('https://example.com/', {}, 'main', () => true);
    safety.cancelAll(); resolve(allow); expect(await second).toBeNull();
  });
  it('acota concurrencia y degrada sin convertir el proveedor en un bloqueo general', async () => {
    const release: Array<() => void> = [];
    const check = vi.fn(() => new Promise<BrowserNavigationSafetyVerdict>((resolve) => release.push(() => resolve(allow))));
    const safety = new BrowserRequestSafety(check);
    const active = Array.from({ length: 32 }, () => safety.review('https://example.com/', {}, 'main', () => true));
    expect(await safety.review('http://example.com/', {}, 'main', () => true)).toMatchObject({ source: 'degraded', action: 'warn' });
    expect(check).toHaveBeenCalledTimes(32); release.forEach((finish) => finish()); await Promise.all(active);
    const next = safety.review('https://example.com/', {}, 'main', () => true); release[32](); expect(await next).toEqual(allow);
  });
});
