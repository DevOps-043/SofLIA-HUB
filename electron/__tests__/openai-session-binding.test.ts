import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetAuthStateForTests, setAuthState } from '../main/auth-state';
import { bindOpenAIHubSession, linkedOpenAIHubUserId } from '../openai-runtime/session-binding';
const session = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock('../main/hub-session', () => ({ getHubSessionUserId: () => session.userId }));
beforeEach(() => { setAuthState({ authenticated: false, userId: null }); resetAuthStateForTests(); session.userId = null; });
describe('Recibo de sesión Lia aceptada para OpenAI', () => {
  it('sin Lia permite sólo selección de entorno nativo', () => { setAuthState({ authenticated: true, userId: 'sofia-A' }); expect(linkedOpenAIHubUserId()).toBeNull(); });
  it('rechaza Lia anterior mientras main ya publica otra identidad', () => {
    setAuthState({ authenticated: true, userId: 'sofia-A' }); session.userId = 'lia-A'; bindOpenAIHubSession('sofia-A'); expect(linkedOpenAIHubUserId()).toBe('lia-A');
    setAuthState({ authenticated: true, userId: 'sofia-B' }); expect(() => linkedOpenAIHubUserId()).toThrow('vinculada');
  });
  it('conserva IDs distintos y habilita la sesión sólo después del recibo', () => {
    setAuthState({ authenticated: true, userId: 'sofia-B' }); session.userId = 'lia-B'; expect(() => linkedOpenAIHubUserId()).toThrow(); bindOpenAIHubSession('sofia-B'); expect(linkedOpenAIHubUserId()).toBe('lia-B');
  });
  it('A/B/A no restaura recibo anterior', () => {
    setAuthState({ authenticated: true, userId: 'sofia-A' }); session.userId = 'lia-A'; bindOpenAIHubSession('sofia-A');
    setAuthState({ authenticated: true, userId: 'sofia-B' }); setAuthState({ authenticated: true, userId: 'sofia-A' }); expect(() => linkedOpenAIHubUserId()).toThrow();
  });
  it('recibo de otra publicación o sujeto Lia cambiado no autoriza', () => {
    setAuthState({ authenticated: true, userId: 'sofia-A' }); session.userId = 'lia-A'; bindOpenAIHubSession('sofia-B'); expect(() => linkedOpenAIHubUserId()).toThrow();
    bindOpenAIHubSession('sofia-A'); session.userId = 'lia-B'; expect(() => linkedOpenAIHubUserId()).toThrow();
  });
});
