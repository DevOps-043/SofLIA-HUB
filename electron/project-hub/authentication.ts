import { getAuthState } from '../main/auth-state';
import { createLogger } from '../utils/logger';
import { captureProjectHubIdentity, waitForProjectHubLease, type ProjectHubOperationAuthorization, type ProjectHubSessionLease } from './session-context';
import { ProjectHubSessionStore } from './session-store';
import { ProjectHubTransport } from './transport';
import { ProjectHubError, projectHubExchange, projectHubFailure, projectHubToken, projectHubTokenPair } from './session-contract';
import type { ProjectHubResult, ProjectHubSession } from './types';

const log = createLogger('project-hub-autenticacion');
const EXPIRY_SKEW_MS = 30_000;
// Compartir la carga del módulo, nunca el identificador que devuelve su getter.
let sofiaIdentityModule: Promise<typeof import('../main/sofia-session')> | undefined;
export type ProjectHubCredentialStorage = Pick<ProjectHubSessionStore, 'load' | 'save' | 'clear'>;

/** Dueño/revisión locales; el servidor conserva la autoridad sobre sus recursos. */
export class ProjectHubAuthentication {
  private owner: string | null = null;
  private session: ProjectHubSession | null = null;
  private sofiaToken: string | null = null;
  private epoch = 0;
  private cancellation = new AbortController();
  private exchangeSequence = 0;
  private flight: { epoch: number; promise: Promise<boolean> } | null = null;
  private lastFailure: Pick<ProjectHubResult, 'code' | 'error'> | null = null;

  constructor(private readonly transport: ProjectHubTransport, private readonly store: ProjectHubCredentialStorage = new ProjectHubSessionStore()) {}

  async capture(authorization?: ProjectHubOperationAuthorization): Promise<ProjectHubSessionLease> {
    const current = getAuthState();
    if (!current.authenticated || !current.userId) throw new ProjectHubError('NOT_AUTHENTICATED', 'Project Hub requiere iniciar sesión.');
    if (this.owner !== current.userId) {
      this.invalidate(); this.owner = current.userId;
    }
    const epoch = this.epoch;
    const lease = captureProjectHubIdentity(this.cancellation.signal, () => {
      if (this.epoch !== epoch || this.owner !== current.userId) throw new ProjectHubError('SESSION_CHANGED', 'La sesión cambió; vuelve a intentar la operación.');
    }, authorization);
    try {
      lease.assert();
      // No cargar clientes/credenciales SOFIA durante un status anónimo. La
      // identidad verificada evita usar el modo compatible de auth:set-state
      // como permiso para abrir credenciales Project Hub de otro usuario.
      const { getSofiaSessionUserId } = await (sofiaIdentityModule ??= import('../main/sofia-session'));
      lease.assert();
      if (getSofiaSessionUserId() !== lease.userId) throw new ProjectHubError('SOFIA_SESSION_PENDING', 'La sesión SOFIA todavía se está verificando.');
      return { ...lease, assert: () => {
        lease.assert();
        if (getSofiaSessionUserId() !== lease.userId) throw new ProjectHubError('SESSION_CHANGED', 'La identidad SOFIA cambió durante la operación.');
      } };
    } catch (error) { lease.dispose(); throw error; }
  }

  async status(authorization?: ProjectHubOperationAuthorization) {
    const empty = { authenticated: false, workspaces: [] as ProjectHubSession['workspaces'], authError: null as Pick<ProjectHubResult, 'code' | 'error'> | null };
    if (!getAuthState().authenticated) return empty;
    let lease: ProjectHubSessionLease | undefined;
    try {
      lease = await this.capture(authorization);
      await this.access(lease); lease.assert();
      return { authenticated: true, workspaces: this.workspaces(lease), authError: this.lastFailure };
    } catch {
      try { lease?.assert(); } catch { return empty; }
      return { ...empty, authError: lease ? this.lastFailure : null };
    } finally { lease?.dispose(); }
  }

  async exchange(token: string): Promise<ProjectHubResult<{ workspaces: ProjectHubSession['workspaces'] }>> {
    let lease: ProjectHubSessionLease | undefined;
    const capturing = this.capture();
    const sequence = ++this.exchangeSequence;
    try { lease = await capturing; return await this.performExchange(token, lease, sequence); }
    catch (error) { return projectHubFailure(error); }
    finally { lease?.dispose(); }
  }

  async retry(authorization?: ProjectHubOperationAuthorization): Promise<ProjectHubResult<{ workspaces: ProjectHubSession['workspaces'] }>> {
    let lease: ProjectHubSessionLease | undefined;
    const token = this.sofiaToken;
    if (!token || this.owner !== getAuthState().userId) {
      return projectHubFailure(new ProjectHubError('SOFIA_SESSION_PENDING', 'La sesión SOFIA todavía se está restaurando.'));
    }
    const capturing = this.capture(authorization);
    const sequence = ++this.exchangeSequence;
    try {
      lease = await capturing;
      return await this.performExchange(token, lease, sequence);
    } catch (error) { return projectHubFailure(error); }
    finally { lease?.dispose(); }
  }

  async restore(): Promise<boolean> {
    let lease: ProjectHubSessionLease | undefined;
    try { lease = await this.capture(); await this.access(lease); return true; }
    catch { return false; }
    finally { lease?.dispose(); }
  }

  async access(lease: ProjectHubSessionLease): Promise<string> {
    lease.assert();
    if (!this.session?.accessToken || this.session.expiresAt <= Date.now() + EXPIRY_SKEW_MS) await this.renew(lease);
    lease.assert();
    if (!this.session?.accessToken || this.session.expiresAt <= Date.now()) throw new ProjectHubError('NOT_AUTHENTICATED', 'Project Hub requiere volver a iniciar sesión.');
    return this.session.accessToken;
  }

  workspaces(lease: ProjectHubSessionLease): ProjectHubSession['workspaces'] {
    lease.assert(); return this.session?.workspaces.map(workspace => ({ ...workspace })) ?? [];
  }

  rejectAccess(accessToken: string): void {
    if (this.session?.accessToken === accessToken) { this.session.accessToken = ''; this.session.expiresAt = 0; }
  }

  async renew(lease: ProjectHubSessionLease, rejectedToken?: string): Promise<boolean> {
    lease.assert();
    if (rejectedToken && this.session?.accessToken && this.session.accessToken !== rejectedToken) return true;
    if (!this.flight || this.flight.epoch !== this.epoch) {
      const flight = { epoch: this.epoch, promise: Promise.resolve(false) };
      this.flight = flight;
      flight.promise = this.refreshOwned().finally(() => { if (this.flight === flight) this.flight = null; });
    }
    const result = await waitForProjectHubLease(this.flight.promise, lease); lease.assert();
    return result || Boolean(this.session?.accessToken && this.session.expiresAt > Date.now());
  }

  async logout(): Promise<void> {
    const owner = this.owner ?? getAuthState().userId;
    const token = this.session?.accessToken;
    this.invalidate(); this.owner = null;
    // La limpieza se encola ahora: una respuesta remota tardía no puede borrar
    // un login nuevo del mismo propietario.
    const clearing = owner ? this.store.clear(owner).catch(() => log.warn('No se pudo retirar la sesión Project Hub del disco.')) : Promise.resolve();
    const revocation = token ? this.transport.request('/api/v1/auth/logout', { method: 'POST', retry: false }, {
      accessToken: token, signal: new AbortController().signal, assert: () => {},
    }).catch(() => log.warn('No se confirmó la revocación remota de Project Hub; el cierre local prevalece.')) : Promise.resolve();
    await Promise.all([clearing, revocation]);
  }

  private async performExchange(token: string, lease: ProjectHubSessionLease, sequence: number): Promise<ProjectHubResult<{ workspaces: ProjectHubSession['workspaces'] }>> {
    if (!projectHubToken.safeParse(token).success) throw new ProjectHubError('INVALID_REQUEST', 'La credencial SOFIA no es válida.');
    const assert = () => {
      lease.assert();
      if (sequence !== this.exchangeSequence) throw new ProjectHubError('SESSION_CHANGED', 'La autenticación fue sustituida.');
    };
    assert(); this.sofiaToken = token;
    try {
      const response = await this.transport.request('/api/v1/auth/sofia/exchange', { method: 'POST', body: { sofia_access_token: token }, retry: false }, { signal: lease.signal, assert });
      assert();
      const data = projectHubExchange.safeParse(response.data);
      if (!data.success) throw new ProjectHubError('INVALID_RESPONSE', 'Project Hub devolvió credenciales inválidas.');
      const session = { accessToken: data.data.access_token, refreshToken: data.data.refresh_token,
        expiresAt: Date.now() + data.data.expires_in * 1000, workspaces: data.data.workspaces };
      this.session = session;
      await this.persist(session, lease, assert); assert(); this.lastFailure = null;
      return { success: true, data: { workspaces: this.workspaces(lease) } };
    } catch (error) {
      try { assert(); const failure = projectHubFailure(error); this.lastFailure = { code: failure.code, error: failure.error }; } catch { /* no publica error en otra sesión */ }
      return projectHubFailure(error);
    }
  }

  private async refreshOwned(): Promise<boolean> {
    let lease: ProjectHubSessionLease | undefined;
    let target: ProjectHubSession | null = null;
    let sequence = this.exchangeSequence;
    try {
      lease = await this.capture(); sequence = this.exchangeSequence;
      if (!this.session) {
        const stored = await this.store.load(lease.userId, lease.assert); lease.assert();
        if (sequence !== this.exchangeSequence) return this.hasAccess();
        if (!this.session && stored) this.session = { ...stored, accessToken: '', expiresAt: 0 };
      }
      target = this.session;
      if (!target) return false;
      if (sequence !== this.exchangeSequence) return Boolean(this.session?.accessToken);
      const response = await this.transport.request('/api/v1/auth/refresh', { method: 'POST', body: { refresh_token: target.refreshToken }, retry: false }, { signal: lease.signal, assert: lease.assert });
      lease.assert();
      if (target !== this.session || sequence !== this.exchangeSequence) return Boolean(this.session?.accessToken);
      const data = projectHubTokenPair.safeParse(response.data);
      if (!data.success) throw new ProjectHubError('INVALID_RESPONSE', 'Project Hub devolvió credenciales inválidas.');
      const session = { accessToken: data.data.access_token, refreshToken: data.data.refresh_token,
        expiresAt: Date.now() + data.data.expires_in * 1000, workspaces: target.workspaces };
      this.session = session;
      const assert = () => { lease!.assert(); if (this.session !== session || sequence !== this.exchangeSequence) throw new ProjectHubError('SESSION_CHANGED', 'La autenticación fue sustituida.'); };
      await this.persist(session, lease, assert); assert(); this.lastFailure = null;
      return true;
    } catch (error) {
      try { lease?.assert(); } catch { return false; }
      if (lease && target === this.session && sequence === this.exchangeSequence && error instanceof ProjectHubError && error.status === 401) {
        this.session = null; await this.store.clear(lease.userId).catch(() => log.warn('No se pudo retirar una sesión Project Hub rechazada.'));
      }
      try { lease?.assert(); } catch { return false; }
      if (lease && sequence === this.exchangeSequence) {
        const failure = projectHubFailure(error); this.lastFailure = { code: failure.code, error: failure.error };
      }
      return false;
    } finally { lease?.dispose(); }
  }

  private async persist(session: ProjectHubSession, lease: ProjectHubSessionLease, assert: () => void): Promise<void> {
    try { await this.store.save(lease.userId, session, assert); }
    catch { assert(); log.warn('La sesión Project Hub queda sólo en memoria; no se pudo confirmar su custodia.'); }
    assert();
  }
  private hasAccess(): boolean { return Boolean(this.session?.accessToken); }
  private invalidate(): void {
    this.epoch++; this.exchangeSequence++; this.cancellation.abort(); this.cancellation = new AbortController();
    this.session = null; this.sofiaToken = null; this.flight = null; this.lastFailure = null;
  }
}
