type LiaSession = { user: { id: string } };
interface ChatSessionSource {
  getSession(): Promise<{ data: { session: LiaSession | null }; error?: unknown }>;
  onAuthStateChange(callback: (event: string, session: LiaSession | null) => void): {
    data: { subscription: { unsubscribe: () => void } };
  };
}
export interface ChatSessionLease {
  readonly cycle: number;
  readonly ready: Promise<void>;
  isCurrent(): boolean;
}
export type ChatSessionReview = ReturnType<typeof createChatSessionReview>;

/** Vincula trabajo local al sujeto observado del SDK; RLS conserva autoridad remota. */
export function createChatSessionReview(source: ChatSessionSource | undefined) {
  let subject: string | null | undefined, cycle = 0, eventObserved = false, closed = false, failed = false;
  let unsubscribe: (() => void) | undefined, settle!: () => void;
  const ready = new Promise<void>(resolve => { settle = resolve; });
  const subjectOf = (session: LiaSession | null): string | null => {
    const id = session?.user?.id; return typeof id === 'string' && id.trim() ? id : null;
  };
  const fail = () => {
    if (closed) return;
    failed = true; cycle += 1; settle();
    console.warn('[chat-sync] No se pudo revisar la sesión; se conservan los pendientes.');
  };
  try {
    if (!source) throw new Error('Servicio de sesión no disponible.');
    const subscription = source.onAuthStateChange((event, session) => {
      if (closed || failed || (event === 'INITIAL_SESSION' && eventObserved)) return;
      const next = event === 'SIGNED_OUT' ? null : subjectOf(session);
      if (event === 'SIGNED_OUT' || (subject !== undefined && subject !== next)) cycle += 1;
      subject = next; eventObserved = true;
      // Un evento vigente también libera una lectura inicial que siga esperando.
      settle();
    }).data.subscription;
    unsubscribe = () => subscription.unsubscribe();
  } catch { fail(); }
  if (!failed && source) {
    void Promise.resolve().then(async () => {
      if (closed || eventObserved) return;
      const result = await source.getSession();
      if (closed || eventObserved) return;
      if (result.error) { fail(); return; }
      subject = subjectOf(result.data.session); settle();
    }).catch(() => { if (!eventObserved) fail(); });
  }
  return {
    capture(userId: string): ChatSessionLease {
      const captured = cycle;
      return { cycle: captured, ready, isCurrent: () => !closed && !failed && subject === userId && cycle === captured };
    },
    dispose(): void {
      if (closed) return;
      closed = true; cycle += 1; settle();
      try { unsubscribe?.(); }
      catch { console.warn('[chat-sync] No se confirmó la retirada del listener de sesión.'); }
    },
  };
}
