export type AuthIntentKind = 'login' | 'sso' | 'sign-out';
export type AuthIntent = { readonly kind: AuthIntentKind; readonly signal: AbortSignal };

/** Ownership local del proveedor; no es una credencial ni un lock entre ventanas. */
export function createAuthOperations(revoke: () => void = () => undefined) {
  let scope = new AbortController();
  let intent: AuthIntent | null = null;
  let subject: string | null | undefined;
  let observed: string | null | undefined;
  let blocked = false;
  let disposed = false;
  let running = false;
  let runningSignal: AbortSignal | null = null;
  let pending: { run: () => void; cancel: () => void } | null = null;

  const isCurrent = (signal: AbortSignal) => !disposed && !signal.aborted && signal === scope.signal;
  const replace = () => { scope.abort(); scope = new AbortController(); observed = undefined; };
  const cancel = (signal: AbortSignal) => {
    if (!isCurrent(signal)) return;
    replace(); intent = null; subject = null; blocked = true; revoke();
  };

  return {
    capture: () => scope.signal,
    isCurrent,
    matchesSubject: (signal: AbortSignal, value: string | null) => isCurrent(signal) && subject === value,
    canRestore: () => !disposed && !intent && !blocked,
    begin(kind: AuthIntentKind): AuthIntent {
      if (disposed) return { kind, signal: scope.signal };
      replace(); blocked = kind === 'sign-out'; subject = undefined;
      intent = { kind, signal: scope.signal };
      revoke();
      return intent;
    },
    finish(value: AuthIntent) {
      if (!isCurrent(value.signal) || intent !== value) return;
      intent = null;
      blocked = value.kind === 'sign-out';
    },
    cancel,
    adopt(signal: AbortSignal, nextSubject: string | null): boolean {
      if (nextSubject !== null && (typeof nextSubject !== 'string' || !nextSubject.trim())) return false;
      if (!isCurrent(signal) || observed !== undefined && observed !== nextSubject) return false;
      subject = nextSubject;
      return true;
    },
    observe(event: string, nextSubject: string | null): boolean {
      if (disposed) return false;
      // Un logout/login físico anterior puede emitir mientras el nuevo dueño
      // espera su turno. Ese evento no se atribuye a la intención pendiente.
      if (runningSignal && !isCurrent(runningSignal)) return false;
      if (intent) {
        if (event === 'SIGNED_OUT' && intent.kind !== 'sign-out') {
          cancel(intent.signal);
          return true;
        }
        if (event !== 'INITIAL_SESSION') observed = nextSubject;
        return false;
      }
      if (blocked && nextSubject !== null) return false;
      if (subject !== nextSubject || event === 'SIGNED_OUT') {
        replace(); subject = nextSubject; blocked = event === 'SIGNED_OUT'; revoke();
      }
      return true;
    },
    enqueue<T>(signal: AbortSignal, work: () => Promise<T>): Promise<T | null> {
      if (!isCurrent(signal)) return Promise.resolve(null);
      return new Promise<T | null>((resolve, reject) => {
        const release = () => signal.removeEventListener('abort', cancel);
        const cancel = () => {
          if (pending === job) pending = null;
          release(); resolve(null);
        };
        const job = { cancel, run: () => {
          release(); running = true; runningSignal = signal;
          // Esperar el resultado físico; cancelar no libera una mutación viva.
          void Promise.resolve().then(() => isCurrent(signal) ? work() : null)
            .then(resolve, reject).finally(() => {
              running = false; runningSignal = null;
              const next = pending; pending = null; next?.run();
            });
        } };
        if (running) {
          // Sólo una continuación pendiente: otra más reciente sustituye la
          // anterior sin retener una cadena ilimitada de closures/credenciales.
          pending?.cancel(); pending = job;
          signal.addEventListener('abort', cancel, { once: true });
        } else job.run();
      });
    },
    activate() {
      if (!disposed) return;
      replace(); disposed = false; blocked = false; subject = undefined;
    },
    dispose() { disposed = true; scope.abort(); intent = null; blocked = true; },
  };
}

export type AuthOperations = ReturnType<typeof createAuthOperations>;
