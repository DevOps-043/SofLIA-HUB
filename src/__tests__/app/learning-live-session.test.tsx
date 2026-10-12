import { StrictMode, type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLearningLiveSession } from '../../app/useLearningLiveSession';
import type { AuthState } from '../../app/app-types';
const mocks = vi.hoisted(() => ({ getPending: vi.fn(), open: vi.fn(), subscribe: vi.fn(() => () => {}), login: vi.fn(async () => {}) }));
vi.mock('../../services/learning-live-service', () => ({ learningLiveService: mocks }));
const reference = { organization_slug: 'acme', session_id: '00000000-0000-4000-8000-000000000031' };
function auth(userId: string | null, sso = false): AuthState {
  return { loading: false, user: userId ? { id: userId } : null, learningSsoAvailable: sso, ssoPending: false, signInWithLearningSso: mocks.login } as unknown as AuthState;
}
beforeEach(() => { vi.clearAllMocks(); mocks.getPending.mockResolvedValue(reference); });
describe('antesala de Learning después del inicio de sesión', () => {
  it('conserva el arranque frío bajo StrictMode sin abrir Zoom automáticamente', async () => {
    const hook = renderHook(() => useLearningLiveSession({ auth: auth('student'), enabled: true, onNotice: vi.fn() }), {
      wrapper: ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>,
    });
    await waitFor(() => expect(hook.result.current.reference).toEqual(reference));
    expect(mocks.open).not.toHaveBeenCalled();
    act(() => hook.result.current.dismiss()); expect(hook.result.current.reference).toBeNull();
  });
  it('mantiene la referencia mientras se autentica y continúa a la misma antesala', async () => {
    const hook = renderHook(({ userId }: { userId: string | null }) => useLearningLiveSession({ auth: auth(userId,true), enabled: true, onNotice: vi.fn() }), { initialProps: { userId: null as string | null } });
    await waitFor(() => expect(mocks.login).toHaveBeenCalledTimes(1));
    expect(hook.result.current.reference).toBeNull();
    hook.rerender({ userId: 'student' });
    await waitFor(() => expect(hook.result.current.reference).toEqual(reference));
    expect(mocks.open).not.toHaveBeenCalled();
  });
  it('oculta la antesala al cerrar la cuenta', async () => {
    const hook = renderHook(({ userId }: { userId: string | null }) => useLearningLiveSession({ auth: auth(userId), enabled: true, onNotice: vi.fn() }), { initialProps: { userId: 'student' as string | null } });
    await waitFor(() => expect(hook.result.current.reference).toEqual(reference));
    hook.rerender({ userId: null }); expect(hook.result.current.reference).toBeNull();
  });
});
