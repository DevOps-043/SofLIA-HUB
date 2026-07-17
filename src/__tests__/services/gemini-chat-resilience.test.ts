import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertGeminiCircuitClosed,
  isRateLimitError,
  isTransientGeminiError,
  resetGeminiResilienceState,
  withGeminiModelCall,
  withGeminiTimeout,
} from '../../services/gemini-chat/resilience';

describe('gemini-chat resilience', () => {
  afterEach(() => {
    vi.useRealTimers();
    resetGeminiResilienceState();
  });

  it('GCHAT-RES-001: resolves successful operations', async () => {
    await expect(withGeminiTimeout('ok', async () => 'done', 100)).resolves.toBe('done');
  });

  it('GCHAT-RES-002: times out slow operations', async () => {
    vi.useFakeTimers();
    const promise = withGeminiTimeout('slow', () => new Promise((resolve) => setTimeout(() => resolve('late'), 1000)), 50);
    const expectation = expect(promise).rejects.toThrow(/tiempo limite/);

    await vi.advanceTimersByTimeAsync(60);
    await expectation;
  });

  it('GCHAT-RES-003: clasifica errores transitorios (429/quota/503) sin falsos positivos de timeout', () => {
    expect(isTransientGeminiError(new Error('[429] You exceeded your quota'))).toBe(true);
    expect(isTransientGeminiError(new Error('[503] The model is overloaded'))).toBe(true);
    expect(isTransientGeminiError(new Error('RESOURCE_EXHAUSTED'))).toBe(true);
    // El "500" dentro de "45000ms" del timeout NO debe contar como transitorio.
    expect(isTransientGeminiError(new Error('call excedio el tiempo limite de 45000ms'))).toBe(false);
    expect(isTransientGeminiError(new Error('safety blocked'))).toBe(false);
  });

  it('GCHAT-RES-004: reintenta un error transitorio (429) y luego triunfa', async () => {
    let calls = 0;
    const operation = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw new Error('[429] quota exceeded');
      return 'ok tras reintento';
    });

    await expect(withGeminiModelCall('rate-limited', operation, { timeoutMs: 1000 })).resolves.toBe('ok tras reintento');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('GCHAT-RES-005: un error NO transitorio no se reintenta', async () => {
    const operation = vi.fn(async () => { throw new Error('safety blocked'); });
    await expect(withGeminiModelCall('safety', operation, { timeoutMs: 1000 })).rejects.toThrow(/safety/);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('GCHAT-RES-006: no reintenta si la señal ya fue abortada (botón Stop)', async () => {
    const controller = new AbortController();
    controller.abort();
    const operation = vi.fn(async () => { throw new Error('[429] quota exceeded'); });
    await expect(withGeminiModelCall('aborted', operation, { signal: controller.signal, timeoutMs: 1000 })).rejects.toThrow();
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('GCHAT-RES-007: isRateLimitError distingue throttling de servicio caido', () => {
    expect(isRateLimitError(new Error('[429] You exceeded your quota'))).toBe(true);
    expect(isRateLimitError(new Error('RESOURCE_EXHAUSTED free_tier'))).toBe(true);
    // Un servicio caido (503/overloaded) NO es rate limit: si debe abrir el breaker.
    expect(isRateLimitError(new Error('[503] The model is overloaded'))).toBe(false);
    expect(isRateLimitError(new Error('internal error'))).toBe(false);
  });

  it('GCHAT-RES-008: agotar los reintentos por rate limit NO abre el circuit breaker', async () => {
    vi.useFakeTimers();
    const operation = vi.fn(async () => { throw new Error('[429] quota exceeded'); });
    // 3 modelos candidatos que fallan por cuota: antes esto abria el breaker
    // y bloqueaba al usuario 60s. Ahora el rate limit no cuenta como falla.
    for (let i = 0; i < 3; i += 1) {
      const settled = withGeminiModelCall('rl', operation, { timeoutMs: 100_000 }).catch((err) => err);
      await vi.advanceTimersByTimeAsync(6_000); // cubre el backoff 1200+3500ms
      expect(String(await settled)).toMatch(/429/);
    }
    expect(() => assertGeminiCircuitClosed()).not.toThrow();
  });

  it('GCHAT-RES-009: fallas de servicio caido (503) SI abren el circuit breaker', async () => {
    vi.useFakeTimers();
    const operation = vi.fn(async () => { throw new Error('[503] service unavailable'); });
    for (let i = 0; i < 3; i += 1) {
      const settled = withGeminiModelCall('down', operation, { timeoutMs: 100_000 }).catch((err) => err);
      await vi.advanceTimersByTimeAsync(6_000);
      expect(String(await settled)).toMatch(/503/);
    }
    expect(() => assertGeminiCircuitClosed()).toThrow(/circuit breaker/);
  });
});
