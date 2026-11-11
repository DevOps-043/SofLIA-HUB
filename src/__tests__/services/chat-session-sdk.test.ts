import { describe, expect, it, vi } from 'vitest';
import { QA_AUTH_USER as USER, createAuthSdkFixture as sdkFixture } from './auth-sdk.fixture';
import { createChatSessionReview } from '../../services/chat/session-review';

describe('adaptador de revisión con SDK Supabase real y transporte ficticio', () => {
  it('revisa sesión en memoria y recibe revocación real del SDK al cerrar', async () => {
    const fixture = sdkFixture();
    let review: ReturnType<typeof createChatSessionReview> | undefined;
    try {
      expect((await fixture.client.auth.setSession(fixture.initial)).error).toBeNull();
      review = createChatSessionReview(fixture.client.auth); const lease = review.capture(USER); await lease.ready;
      expect(lease.isCurrent()).toBe(true); expect(review.capture('otra-identidad').isCurrent()).toBe(false);
      expect((await fixture.client.auth.signOut({ scope: 'local' })).error).toBeNull();
      await vi.waitFor(() => expect(lease.isCurrent()).toBe(false)); expect(fixture.fetch).toHaveBeenCalled();
    } finally { review?.dispose(); await fixture.client.auth.dispose(); }
  });
  it('renovación real del SDK conserva sujeto/ciclo sin persistir tokens del fixture', async () => {
    const fixture = sdkFixture(); const events: string[] = [];
    let review: ReturnType<typeof createChatSessionReview> | undefined, unsubscribe: (() => void) | undefined;
    try {
      expect((await fixture.client.auth.setSession(fixture.initial)).error).toBeNull();
      const observer = fixture.client.auth.onAuthStateChange(event => { events.push(event); });
      unsubscribe = () => observer.data.subscription.unsubscribe();
      review = createChatSessionReview(fixture.client.auth); const lease = review.capture(USER); await lease.ready;
      expect((await fixture.client.auth.refreshSession()).error).toBeNull();
      await vi.waitFor(() => expect(events).toContain('TOKEN_REFRESHED')); expect(lease.isCurrent()).toBe(true);
      review.dispose(); expect(lease.isCurrent()).toBe(false);
    } finally { unsubscribe?.(); review?.dispose(); await fixture.client.auth.dispose(); }
  });
});
