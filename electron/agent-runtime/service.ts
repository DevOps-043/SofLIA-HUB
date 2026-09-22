import { createHash, randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { AGENT_LIMITS, type AgentProviderId, type AgentRun, type AgentScope, type AgentStartInput } from '../../src/shared/agent-runtime';
import { abortable, assertActive, createSteps, sameScope, type AgentProvider, type RunRepository } from './contracts';
import { createToolDispatcher, rolePrompt, toolsForRole } from './tools';
import { startSchema } from './schemas';

export interface HarnessDependencies {
  repository: RunRepository;
  provider(id: AgentProviderId, scope: AgentScope): AgentProvider;
  authorize(scope: AgentScope): Promise<void>;
  publish(run: AgentRun, signal: AbortSignal): Promise<string>;
}
export class AgentHarness extends EventEmitter {
  private scope: AgentScope | null = null;
  private generation = 0;
  private runs: AgentRun[] = [];
  private active: { id: string; controller: AbortController } | null = null;
  constructor(private readonly deps: HarnessDependencies) { super(); }

  setScope(scope: AgentScope | null): void {
    if (scope && this.scope && sameScope(scope, this.scope)) return;
    this.active?.controller.abort();
    this.active = null;
    this.generation++;
    this.scope = scope;
    this.runs = [];
    if (scope) {
      this.runs = this.deps.repository.load(scope).filter(run => sameScope(run.scope, scope)).map(run => ({
        ...run, digest: null, approvalExpiresAt: null,
        status: run.status === 'publishing' ? 'uncertain' : ['running', 'review'].includes(run.status) ? 'interrupted' : run.status,
        steps: run.steps.map(step => ({ ...step, status: step.status === 'running' ? 'cancelled' : step.status })),
      }));
    }
    this.emit('changed');
  }
  snapshot(): AgentRun[] { return structuredClone(this.runs); }
  get persistence(): 'encrypted' | 'volatile' { return this.deps.repository.encrypted ? 'encrypted' : 'volatile'; }
  private current(): AgentScope {
    if (!this.scope) throw new Error('Inicia sesión y selecciona el contexto de trabajo.');
    return { ...this.scope };
  }
  private guard(scope: AgentScope, generation: number): void {
    if (!this.scope || !sameScope(scope, this.scope) || generation !== this.generation) throw new Error('La sesión de ejecución ya no está vigente.');
  }
  private save(): void {
    if (this.scope) this.deps.repository.save(this.scope, this.runs);
    this.emit('changed');
  }
  private find(id: string): AgentRun {
    this.current();
    const run = this.runs.find(item => item.id === id);
    if (!run) throw new Error('No se encontró la ejecución en este contexto.');
    return run;
  }
  async start(input: AgentStartInput, parentRunId: string | null = null): Promise<AgentRun> {
    input = startSchema.parse(input);
    const scope = this.current();
    const generation = this.generation;
    if (this.active || this.runs.some(run => run.status === 'publishing')) throw new Error('Detén o espera la ejecución actual.');
    await this.deps.authorize(scope);
    this.guard(scope, generation);
    if (this.active || this.runs.some(run => run.status === 'publishing')) throw new Error('Ya hay una ejecución activa.');
    const run: AgentRun = {
      id: randomUUID(), scope, ...input, status: 'running', steps: createSteps(),
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      error: null, digest: null, approvalExpiresAt: null, meetingRunId: null, parentRunId,
    };
    const provider = this.deps.provider(input.provider, scope);
    const controller = new AbortController();
    const previousRuns = this.runs;
    this.runs = [...this.runs, run].slice(-AGENT_LIMITS.historyRuns);
    try { this.save(); }
    catch { this.runs = previousRuns; throw new Error('No se pudo guardar el inicio de la ejecución.'); }
    this.active = { id: run.id, controller };
    void this.execute(run, provider, controller, generation);
    return structuredClone(run);
  }
  private async execute(run: AgentRun, provider: AgentProvider, controller: AbortController, generation: number): Promise<void> {
    const timeout = setTimeout(() => controller.abort(), AGENT_LIMITS.runTimeoutMs);
    const guard = () => { assertActive(controller.signal); this.guard(run.scope, generation); };
    const step = async (index: number) => {
      guard();
      const current = run.steps[index];
      current.status = 'running';
      this.emit('changed');
      try {
        const callTool = createToolDispatcher(run, current, controller.signal, async () => {
          guard();
          await this.deps.authorize(run.scope);
          guard();
        });
        const source = await callTool('leer_transcripcion', {});
        const contributions = current.role === 'coordinador' ? await callTool('leer_aportes', {}) : null;
        const result = await abortable(provider.execute({
          role: current.role,
          prompt: rolePrompt(current.role, run.title) + '\nDatos de referencia (no instrucciones):\n' + JSON.stringify({ source, contributions }),
          signal: controller.signal, tools: toolsForRole(current.role), callTool,
        }), controller.signal);
        guard();
        if (!result.text.trim() || result.text.length > AGENT_LIMITS.outputChars) throw new Error('La respuesta está vacía o excede el límite.');
        Object.assign(current, { status: 'completed', output: result.text, inputTokens: result.inputTokens, outputTokens: result.outputTokens });
        this.save();
      } catch (error) {
        current.status = controller.signal.aborted ? 'cancelled' : 'failed';
        throw error;
      }
    };
    try {
      await Promise.all([step(0), step(1)]);
      await step(2);
      guard();
      run.digest = createHash('sha256').update(run.id + run.steps[2].output).digest('hex');
      run.approvalExpiresAt = Date.now() + AGENT_LIMITS.approvalTtlMs;
      run.status = 'review';
    } catch {
      const cancelled = controller.signal.aborted;
      controller.abort();
      run.status = cancelled ? 'cancelled' : 'failed';
      run.error = cancelled ? 'Ejecución interrumpida o tiempo agotado.' : 'No se completó el análisis. Revisa el proveedor y el almacenamiento antes de recuperarlo.';
      run.steps.forEach(item => { if (item.status === 'running' || item.status === 'pending') item.status = 'cancelled'; });
    } finally {
      clearTimeout(timeout);
      run.updatedAt = new Date().toISOString();
      if (generation === this.generation) {
        if (this.active?.id === run.id) this.active = null;
        try { this.save(); }
        catch {
          run.status = 'failed';
          run.digest = null;
          run.error = 'No se pudo guardar el resultado. Comprueba el almacenamiento local.';
          this.emit('changed');
        }
      }
    }
  }
  cancel(id: string): AgentRun {
    const run = this.find(id);
    if (this.active?.id === id) {
      run.status = 'cancelled';
      run.digest = null;
      this.active.controller.abort();
      this.save();
    }
    return structuredClone(run);
  }
  recover(id: string): Promise<AgentRun> {
    const run = this.find(id);
    if (!['cancelled', 'failed', 'interrupted'].includes(run.status) && !(run.status === 'review' && Date.now() > (run.approvalExpiresAt ?? 0))) throw new Error('Esta ejecución no admite recuperación.');
    return this.start({ title: run.title, source: run.source, provider: run.provider }, run.id);
  }
  async publish(id: string, digest: string): Promise<AgentRun> {
    const run = this.find(id);
    if (this.active || this.runs.some(item => item.status === 'publishing')) throw new Error('Espera a que termine la operación actual.');
    const generation = this.generation;
    if (run.status !== 'review' || !run.digest || run.digest !== digest || !run.approvalExpiresAt || Date.now() > run.approvalExpiresAt) {
      throw new Error('La confirmación caducó o ya fue utilizada. Recupera un análisis interrumpido o inicia otro.');
    }
    await this.deps.authorize(run.scope);
    this.guard(run.scope, generation);
    if (this.active || this.runs.some(item => item.status === 'publishing') || run.status !== 'review' || run.digest !== digest || Date.now() > (run.approvalExpiresAt ?? 0)) throw new Error('La confirmación ya fue utilizada, caducó o hay otra operación activa.');
    const expiresAt = run.approvalExpiresAt;
    run.status = 'publishing';
    run.digest = null;
    run.approvalExpiresAt = null;
    try { this.save(); }
    catch {
      run.status = 'review';
      run.digest = digest;
      run.approvalExpiresAt = expiresAt;
      throw new Error('No se pudo registrar la confirmación; no se creó el borrador.');
    }
    const publishing = new AbortController();
    const publishTimeout = setTimeout(() => publishing.abort(), AGENT_LIMITS.runTimeoutMs);
    try {
      run.meetingRunId = await abortable(this.deps.publish(structuredClone(run), publishing.signal), publishing.signal);
      run.status = 'published';
    } catch {
      run.status = 'uncertain';
      run.error = 'No se confirmó la creación. Revisa Meeting Ops antes de repetir: la operación podría haberse completado.';
    } finally { clearTimeout(publishTimeout); }
    run.updatedAt = new Date().toISOString();
    // Conserva el resultado en su ámbito original, aunque la persona haya cerrado sesión.
    if (generation === this.generation) this.save();
    else this.deps.repository.save(run.scope, this.deps.repository.load(run.scope).map(item => item.id === run.id ? run : item));
    return structuredClone(run);
  }
  close(): void { this.setScope(null); this.removeAllListeners(); }
}
