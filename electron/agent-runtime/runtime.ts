import path from 'node:path';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { AgentHarness } from './service';
import { EncryptedRunRepository, type StateCipher } from './repository';
import { GeminiAgentProvider } from './gemini-provider';
import { codexHome, CodexAgentProvider, verifyCodexExecutable, type CodexConfiguration } from '../codex-runtime';
import type { AgentRuntimeState, AgentScope } from '../../src/shared/agent-runtime';
import type { MeetingWorkflowService } from '../meetings/meeting-workflow-service';
import { assertActive, sameScope } from './contracts';

interface RuntimeOptions {
  root: string;
  cipher: StateCipher;
  getUserId(): string | null;
  getMeetingOwnerId(): string | null;
  authorize(scope: AgentScope): Promise<void>;
  geminiKey(): string | null;
  meetings: Pick<MeetingWorkflowService, 'createManualRun'>;
}
interface PrivateSettings { codex: CodexConfiguration | null; apiKey: string | null }
export class AgentRuntime {
  readonly harness: AgentHarness;
  private scope: AgentScope | null = null;
  private contextVersion = 0;
  private settings: PrivateSettings = { codex: null, apiKey: null };
  constructor(private readonly options: RuntimeOptions) {
    this.harness = new AgentHarness({
      repository: new EncryptedRunRepository(path.join(options.root, 'runs'), options.cipher),
      authorize: scope => this.authorize(scope),
      provider: (id, scope) => {
        if (id === 'gemini') {
          const key = options.geminiKey();
          if (!key) throw new Error('Configura Gemini en SofLIA antes de iniciar.');
          return new GeminiAgentProvider(key);
        }
        if (!this.settings.codex) throw new Error('Selecciona un ejecutable compatible de Codex.');
        return new CodexAgentProvider(this.settings.codex, codexHome(path.join(options.root, 'codex'), scope), this.settings.apiKey ?? undefined);
      },
      publish: async (run, signal) => {
        const version = this.contextVersion;
        const meetingOwnerId = options.getMeetingOwnerId();
        if (!meetingOwnerId) throw new Error('La sesión de Lia no está disponible.');
        await this.authorize(run.scope);
        const guard = () => {
          assertActive(signal);
          if (version !== this.contextVersion || this.options.getUserId() !== run.scope.userId || options.getMeetingOwnerId() !== meetingOwnerId) throw new Error('La sesión cambió durante la creación.');
        };
        guard();
        const result = await options.meetings.createManualRun({
          ownerUserId: meetingOwnerId, organizationId: run.scope.organizationId,
          originChannel: 'app', originRef: 'soflia-agent:' + run.id,
          meetingTitle: run.title,
          text: run.steps[2].output + '\n\nFuente original proporcionada:\n' + run.source,
        }, guard);
        return result.detail.run.id;
      },
    });
  }
  private async authorize(scope: AgentScope): Promise<void> {
    if (this.options.getUserId() !== scope.userId || !this.scope || !sameScope(scope, this.scope)) throw new Error('Sesión no vigente.');
    await this.options.authorize(scope);
    if (this.options.getUserId() !== scope.userId || !this.scope || !sameScope(scope, this.scope)) throw new Error('Sesión no vigente.');
  }
  async setContext(organizationId: string | null): Promise<AgentRuntimeState> {
    const userId = this.options.getUserId();
    if (!userId) throw new Error('Inicia sesión en SofLIA.');
    const scope = { userId, organizationId };
    if (this.scope && sameScope(scope, this.scope)) { await this.authorize(scope); return this.state(); }
    this.invalidate();
    const version = this.contextVersion;
    await this.options.authorize(scope);
    if (version !== this.contextVersion || userId !== this.options.getUserId()) throw new Error('El contexto cambió durante la validación.');
    this.scope = scope;
    this.settings = this.loadSettings(scope);
    try { this.harness.setScope(scope); }
    catch { this.invalidate(); throw new Error('No se pudo abrir el historial cifrado.'); }
    return this.state();
  }
  invalidate(): void {
    this.contextVersion++;
    this.scope = null;
    this.settings = { codex: null, apiKey: null };
    this.harness.setScope(null);
  }
  requireContext(): AgentScope {
    if (!this.scope || this.options.getUserId() !== this.scope.userId) throw new Error('Selecciona un contexto autenticado.');
    return this.scope;
  }
  state(): AgentRuntimeState {
    const scope = this.requireContext();
    return {
      scope: { ...scope },
      runs: this.harness.snapshot(), persistence: this.harness.persistence,
      geminiAvailable: !!this.options.geminiKey(),
      codex: { configured: !!this.settings.codex && !!this.settings.apiKey, version: this.settings.codex?.version ?? null, home: this.settings.codex ? codexHome(path.join(this.options.root, 'codex'), scope) : null },
    };
  }
  async configureCodex(executable: string): Promise<void> {
    const scope = this.requireContext();
    this.requireIdle();
    const version = this.contextVersion;
    const verified = await verifyCodexExecutable(executable);
    if (version !== this.contextVersion) throw new Error('La sesión cambió.');
    await this.authorize(scope);
    if (version !== this.contextVersion) throw new Error('La sesión cambió.');
    this.requireIdle();
    this.settings.codex = verified;
    this.saveSettings(scope);
  }
  setCodexKey(apiKey: string): void {
    const scope = this.requireContext();
    this.requireIdle();
    this.settings.apiKey = apiKey.trim() || null;
    this.saveSettings(scope);
  }
  private requireIdle(): void {
    if (this.harness.snapshot().some(run => run.status === 'running' || run.status === 'publishing')) throw new Error('Espera a que termine la ejecución antes de cambiar credenciales.');
  }
  private settingsPath(scope: AgentScope): string {
    return path.join(this.options.root, 'settings-' + createHash('sha256').update(JSON.stringify(scope)).digest('hex') + '.bin');
  }
  private loadSettings(scope: AgentScope): PrivateSettings {
    if (!this.options.cipher.isEncryptionAvailable()) return { codex: null, apiKey: null };
    try {
      const result = JSON.parse(this.options.cipher.decryptString(fs.readFileSync(this.settingsPath(scope))));
      if (result.codex && (!path.isAbsolute(result.codex.executable) || typeof result.codex.version !== 'string')) throw new Error();
      return { codex: result.codex ?? null, apiKey: typeof result.apiKey === 'string' ? result.apiKey : null };
    } catch { return { codex: null, apiKey: null }; }
  }
  private saveSettings(scope: AgentScope): void {
    if (!this.options.cipher.isEncryptionAvailable()) return;
    fs.mkdirSync(this.options.root, { recursive: true });
    const file = this.settingsPath(scope);
    fs.writeFileSync(file + '.tmp', this.options.cipher.encryptString(JSON.stringify(this.settings)), { mode: 0o600 });
    fs.renameSync(file + '.tmp', file);
  }
}
