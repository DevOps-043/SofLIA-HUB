import { randomUUID } from 'node:crypto';
import type { OpenAIAuthority, OpenAICaller, OpenAIScope } from './types';

/** A lo sumo un scope por superficie confiable; la lease se conserva hasta revocación. */
export class OpenAIScopeRegistry {
  private readonly scopes = new Map<object, OpenAIScope>();
  constructor(private readonly bind: (caller: OpenAICaller) => OpenAIAuthority, private readonly revoke: (scope: OpenAIScope) => void) {}
  open(sender: object, frame: unknown, caller: OpenAICaller): { scope: OpenAIScope; retained: boolean } {
    caller.assert();
    const previous = this.scopes.get(sender);
    if (previous) {
      try {
        previous.authority.assert();
        if (previous.frame === frame && previous.userId === caller.userId) return { scope: previous, retained: false };
      } catch { /* Retirar exclusivamente el scope revocado. */ }
      previous.authority.dispose();
    }
    if (!caller.userId || this.scopes.size >= 4) throw new Error('No se pudo abrir otro scope de inferencia.');
    const authority = this.bind(caller);
    const scope: OpenAIScope = { id: randomUUID(), sender, frame, userId: caller.userId, authority };
    let closed = false;
    const close = () => {
      if (closed) return; closed = true;
      if (this.scopes.get(sender) === scope) this.scopes.delete(sender);
      authority.signal.removeEventListener('abort', close);
      try { this.revoke(scope); } finally { authority.dispose(); }
    };
    this.scopes.set(sender, scope);
    authority.signal.addEventListener('abort', close, { once: true });
    if (authority.signal.aborted) close();
    authority.assert();
    return { scope, retained: true };
  }
  get(sender: object, frame: unknown, id: string, userId: string | null): OpenAIScope {
    const scope = this.scopes.get(sender);
    if (!scope || scope.id !== id || scope.frame !== frame || scope.userId !== userId) throw new Error('Scope de inferencia no autorizado.');
    scope.authority.assert(); return scope;
  }
}
