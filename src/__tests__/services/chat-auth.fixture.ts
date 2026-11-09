import { vi } from 'vitest';

export type TestChatSession = { user: { id: string } };
type Listener = (event: string, session: TestChatSession | null) => void;
type ReadResult = { data: { session: TestChatSession | null }; error: Error | null };
const listeners = new Set<Listener>();
let subject: string | null = null;
const getSession = vi.fn<() => Promise<ReadResult>>();
const unsubscribe = vi.fn<() => void>();
const onAuthStateChange = vi.fn<(callback: Listener) => { data: { subscription: { unsubscribe: () => void } } }>();
const session = (userId: string | null): TestChatSession | null => userId === null ? null : { user: { id: userId } };

export const chatAuth = {
  source: { getSession, onAuthStateChange }, listeners, unsubscribe,
  reset(userId: string | null) {
    subject = userId; listeners.clear(); unsubscribe.mockReset(); getSession.mockReset(); onAuthStateChange.mockReset();
    getSession.mockImplementation(async () => ({ data: { session: session(subject) }, error: null }));
    onAuthStateChange.mockImplementation(callback => {
      listeners.add(callback);
      return { data: { subscription: { unsubscribe: () => { listeners.delete(callback); unsubscribe(); } } } };
    });
  },
  notify(event: string, userId: string | null) {
    for (const listener of [...listeners]) listener(event, session(userId));
  },
  change(event: string, userId: string | null) { subject = userId; this.notify(event, userId); },
};
