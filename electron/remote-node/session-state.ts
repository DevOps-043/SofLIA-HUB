import { getAuthState, onAuthStateChange } from '../main/auth-state';
import { createLogger } from '../utils/logger';
import { RemoteNodeCredentialStore } from './state-store';
import { buildDefaultState } from './state-utils';
import { copyRemoteNodeState, remoteNodeOwner, remoteNodePayload } from './state-contract';
import type { RemoteNodeState } from './types';
import type { RemoteNodeOperationContext } from './operation-context';

interface ActiveSession {
  owner: string; state: RemoteNodeState; identity: AbortController; configuration: AbortController;
  ready: Promise<void>; queue: Promise<unknown>; loaded: boolean; revision: number;
}
export interface RemoteNodeSessionLease extends RemoteNodeOperationContext { owner: string; state: RemoteNodeState }
const log = createLogger('nodos-remotos-sesion');

/** Identidad y commit de estado; no conoce sockets, UI ni herramientas runtime. */
export class RemoteNodeSessionState {
  private active: ActiveSession | null = null;
  private unsubscribe: (() => void) | null = null;
  private changed: (revoked: boolean) => void = () => undefined;
  private readonly anonymous = buildDefaultState();
  version = 0;
  constructor(private readonly store = new RemoteNodeCredentialStore()) {}
  async start(changed: (revoked: boolean) => void): Promise<void> {
    if (!this.unsubscribe) {
      this.changed = changed;
      this.unsubscribe = onAuthStateChange(() => this.switchIdentity());
      this.switchIdentity();
    }
    await this.active?.ready;
  }
  private assert(session: ActiveSession): void {
    const auth = getAuthState();
    if (this.active !== session || session.identity.signal.aborted || !auth.authenticated || auth.userId !== session.owner) throw new Error('La sesión de nodos ya no está vigente.');
  }
  private switchIdentity(): void {
    this.active?.identity.abort(); this.active?.configuration.abort(); this.active = null; this.version++;
    this.changed(true);
    const auth = getAuthState();
    if (!auth.authenticated || !auth.userId || !remoteNodeOwner.safeParse(auth.userId).success) return;
    const session: ActiveSession = { owner: auth.userId, state: buildDefaultState(), identity: new AbortController(), configuration: new AbortController(),
      ready: Promise.resolve(), queue: Promise.resolve(), loaded: false, revision: 0 };
    this.active = session;
    session.ready = this.store.load(session.owner, () => this.assert(session)).then(state => {
      this.assert(session); session.state = state; session.loaded = true; this.version++; this.changed(false);
    });
    void session.ready.catch(() => { log.warn('No se pudo restaurar el perfil cifrado de nodos.'); });
  }
  private async current(): Promise<ActiveSession> {
    const session = this.active;
    if (!session) throw new Error('Inicia sesión para usar nodos remotos.');
    await session.ready; this.assert(session); return session;
  }
  async identity(): Promise<RemoteNodeSessionLease> {
    const session = await this.current(); this.assert(session);
    return { owner: session.owner, state: session.state, signal: session.identity.signal, assertCurrent: () => this.assert(session) };
  }
  async review(external?: RemoteNodeOperationContext): Promise<RemoteNodeSessionLease> {
    const session = await this.current(); this.assert(session); external?.assertCurrent();
    const revision = session.revision;
    const signal = AbortSignal.any([session.identity.signal, session.configuration.signal, ...(external?.signal ? [external.signal] : [])]);
    const assertCurrent = () => {
      this.assert(session); external?.assertCurrent();
      if (signal.aborted || revision !== session.revision) throw new Error('La configuración de nodos cambió durante la revisión.');
    };
    assertCurrent(); return { owner: session.owner, state: session.state, signal, assertCurrent, onDispatch: external?.onDispatch };
  }
  async mutate<T>(operation: (next: RemoteNodeState, owner: string) => T, context?: RemoteNodeOperationContext, configuration = true): Promise<T> {
    const session = await this.current();
    const result = session.queue.then(async () => {
      const assert = () => { this.assert(session); context?.assertCurrent(); if (context?.signal?.aborted) throw new Error('Operación de nodos cancelada.'); };
      assert(); const next = copyRemoteNodeState(session.state); const value = operation(next, session.owner);
      const prepared = remoteNodePayload(session.owner, next).state;
      context?.onDispatch?.(); await this.store.save(session.owner, prepared, assert); assert();
      Object.assign(session.state, prepared);
      if (configuration) {
        session.configuration.abort(); session.configuration = new AbortController(); session.revision++; this.version++; this.changed(false);
      }
      return value;
    });
    session.queue = result.catch(() => undefined); return result;
  }
  peek(): RemoteNodeSessionLease {
    const session = this.active;
    if (!session?.loaded) return { owner: '', state: this.anonymous, signal: AbortSignal.abort(), assertCurrent: () => { throw new Error('Host remoto sin sesión vigente.'); } };
    return { owner: session.owner, state: session.state, signal: session.identity.signal, assertCurrent: () => this.assert(session) };
  }
  dispose(): void {
    this.unsubscribe?.(); this.unsubscribe = null;
    this.active?.identity.abort(); this.active?.configuration.abort(); this.active = null; this.version++; this.changed(true);
  }
}
