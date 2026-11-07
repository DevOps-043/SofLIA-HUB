import { describe, expect, it, vi } from 'vitest';
import { createAuthOperations } from '../../contexts/auth/auth-operations';
import { deferred } from './auth-lifecycle.fixture';

describe('Coordinador privado de intenciones Auth', () => {
  it('invalida A/B/A antes de esperar y final antiguo no libera intención nueva', () => {
    const revoke = vi.fn();
    const operations = createAuthOperations(revoke);
    const first = operations.begin('login');
    const second = operations.begin('sign-out');
    const third = operations.begin('login');
    operations.finish(first); operations.finish(second);
    expect(first.signal.aborted).toBe(true);
    expect(second.signal.aborted).toBe(true);
    expect(operations.isCurrent(third.signal)).toBe(true);
    expect(operations.canRestore()).toBe(false);
    expect(revoke).toHaveBeenCalledTimes(3);
  });

  it('cierre bloquea restauración espontánea hasta otra intención', () => {
    const operations = createAuthOperations();
    const closing = operations.begin('sign-out'); operations.finish(closing);
    expect(operations.observe('SIGNED_IN', 'a')).toBe(false);
    expect(operations.observe('INITIAL_SESSION', 'a')).toBe(false);
    const login = operations.begin('login');
    expect(operations.observe('SIGNED_IN', 'a')).toBe(false);
    expect(operations.adopt(login.signal, 'a')).toBe(true);
    operations.finish(login);
    expect(operations.canRestore()).toBe(true);
  });

  it('el sujeto Auth observado prevalece, sin usar un ID de perfil', () => {
    const operations = createAuthOperations();
    const intent = operations.begin('sso');
    operations.observe('SIGNED_IN', 'auth-a');
    expect(operations.adopt(intent.signal, 'perfil-a')).toBe(false);
    expect(operations.adopt(intent.signal, 'auth-a')).toBe(true);
    expect(operations.matchesSubject(intent.signal, 'auth-a')).toBe(true);
    expect(operations.matchesSubject(intent.signal, 'perfil-a')).toBe(false);
  });

  it('sólo retiene una continuación pendiente y libera la sustituida', async () => {
    const operations = createAuthOperations();
    const signal = operations.capture();
    const pending = deferred<string>();
    const first = operations.enqueue(signal, () => pending.promise);
    const skipped = vi.fn(async () => 'omitida');
    const second = operations.enqueue(signal, skipped);
    const third = operations.enqueue(signal, async () => 'tercera');
    expect(await second).toBeNull();
    pending.resolve('primera');
    expect(await first).toBe('primera');
    expect(await third).toBe('tercera');
    expect(skipped).not.toHaveBeenCalled();
  });

  it('cancelar pendiente libera su listener antes de terminar el activo', async () => {
    const operations = createAuthOperations();
    const firstIntent = operations.begin('login');
    const network = deferred<string>();
    const active = operations.enqueue(firstIntent.signal, () => network.promise);
    await Promise.resolve();
    const queuedIntent = operations.begin('sso');
    const remove = vi.spyOn(queuedIntent.signal, 'removeEventListener');
    const next = operations.enqueue(queuedIntent.signal, async () => 'siguiente');
    operations.cancel(queuedIntent.signal);
    expect(await next).toBeNull();
    expect(remove).toHaveBeenCalledOnce();
    network.resolve('anterior');
    await active;
  });

  it('un rechazo libera cola y los eventos del escritor revocado no cancelan al pendiente', async () => {
    const operations = createAuthOperations();
    const firstIntent = operations.begin('sign-out');
    const network = deferred<string>();
    const first = operations.enqueue(firstIntent.signal, () => network.promise).catch(() => null);
    await Promise.resolve();
    const nextIntent = operations.begin('login');
    const next = operations.enqueue(nextIntent.signal, async () => 'nueva');
    expect(operations.observe('SIGNED_OUT', null)).toBe(false);
    expect(operations.isCurrent(nextIntent.signal)).toBe(true);
    network.reject(new Error('fallo ficticio'));
    await first;
    expect(await next).toBe('nueva');
  });

  it('dispose es idempotente, no ejecuta trabajo retenido y activate crea otra señal', async () => {
    const revoke = vi.fn();
    const operations = createAuthOperations(revoke);
    const signal = operations.capture();
    operations.dispose(); operations.dispose();
    const invalid = operations.begin('login');
    expect(revoke).not.toHaveBeenCalled();
    expect(await operations.enqueue(invalid.signal, async () => 'invalida')).toBeNull();
    operations.activate();
    expect(signal.aborted).toBe(true);
    expect(operations.capture()).not.toBe(signal);
    expect(operations.canRestore()).toBe(true);
  });
});
