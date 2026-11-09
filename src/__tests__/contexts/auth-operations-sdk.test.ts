import { describe, expect, it, vi } from 'vitest';
import { createAuthOperations } from '../../contexts/auth/auth-operations';
import { createAuthSdkFixture, QA_AUTH_USER } from '../services/auth-sdk.fixture';
import { deferred } from './auth-lifecycle.fixture';

describe('Ownership con SDK Supabase real y transporte ficticio', () => {
  it('SIGNED_IN propio y TOKEN_REFRESHED no cancelan al propietario válido', async () => {
    const fixture = createAuthSdkFixture();
    const operations = createAuthOperations();
    const events: string[] = [];
    const { data: { subscription } } = fixture.client.auth.onAuthStateChange((event, value) => {
      events.push(event); operations.observe(event, value?.user.id ?? null);
    });
    try {
      const intent = operations.begin('login');
      const accepted = await operations.enqueue(intent.signal, async () => {
        const result = await fixture.client.auth.setSession(fixture.initial);
        expect(result.error).toBeNull();
        return operations.adopt(intent.signal, result.data.session!.user.id);
      });
      expect(accepted).toBe(true); expect(events).toContain('SIGNED_IN');
      operations.finish(intent);
      expect((await fixture.client.auth.refreshSession()).error).toBeNull();
      expect(events).toContain('TOKEN_REFRESHED');
      expect(operations.isCurrent(intent.signal)).toBe(true);
      expect(operations.matchesSubject(intent.signal, QA_AUTH_USER)).toBe(true);
    } finally { subscription.unsubscribe(); operations.dispose(); await fixture.client.auth.dispose(); }
  });

  it('SIGNED_OUT físico anterior no revoca otro acceso que espera la cola', async () => {
    const fixture = createAuthSdkFixture();
    const operations = createAuthOperations();
    const network = deferred<void>();
    let logoutObserved = false;
    const { data: { subscription } } = fixture.client.auth.onAuthStateChange((event, value) => {
      if (event === 'SIGNED_OUT') logoutObserved = true;
      operations.observe(event, value?.user.id ?? null);
    });
    try {
      expect((await fixture.client.auth.setSession(fixture.initial)).error).toBeNull();
      const transport = fixture.fetch.getMockImplementation()!;
      let logoutStarted = false;
      fixture.fetch.mockImplementation(async (input, init) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (new URL(url).pathname.endsWith('/logout')) { logoutStarted = true; await network.promise; }
        return transport(input, init);
      });
      const closing = operations.begin('sign-out');
      const old = operations.enqueue(closing.signal, () => fixture.client.auth.signOut());
      await vi.waitFor(() => expect(logoutStarted).toBe(true));
      const next = operations.begin('login');
      const incoming = operations.enqueue(next.signal, async () => {
        const result = await fixture.client.auth.setSession(fixture.initial);
        expect(result.error).toBeNull();
        return operations.adopt(next.signal, result.data.session!.user.id);
      });
      network.resolve();
      await old;
      expect(await incoming).toBe(true); expect(logoutObserved).toBe(true);
      expect(operations.isCurrent(next.signal)).toBe(true);
      expect((await fixture.client.auth.getSession()).data.session?.user.id).toBe(QA_AUTH_USER);
    } finally { network.resolve(); subscription.unsubscribe(); operations.dispose(); await fixture.client.auth.dispose(); }
  });
});
