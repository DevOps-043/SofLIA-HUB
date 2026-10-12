import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { BackgroundAction, BackgroundAgent, BackgroundJob, BackgroundScope, BackgroundStart, BackgroundState } from '../../src/shared/background-teams';
import { BACKGROUND_LIMITS, isActiveBackgroundJob, sameBackgroundScope } from '../../src/shared/background-teams';
import { selectTeam } from '../../src/shared/agent-teams/policy';
import { BackgroundRepository } from './repository';
import { ArtifactStore } from './artifacts';
import { assertExecuting, type BackgroundProvider } from './contracts';
import { startSchema } from './schemas';
import { toolSchemas, toolsForAgent } from './tools';

export interface BackgroundServiceOptions {
  repository: BackgroundRepository;
  resolveScope(organizationId: string | null): Promise<BackgroundScope>;
  authorize(scope: BackgroundScope): Promise<void>;
  provider(job: BackgroundJob): Promise<BackgroundProvider>;
  verifyLegacyBinding?(job: BackgroundJob, input: { messageId: string; conversationId: string }): Promise<void>;
}
export class BackgroundTeamService extends EventEmitter {
  readonly artifacts: ArtifactStore;
  private scope: BackgroundScope | null = null;
  private jobs: BackgroundJob[] = [];
  private generation = 0;
  private active: { id: string; controller: AbortController; promise: Promise<void>; startedAt: number } | null = null;
  private admissions: Promise<unknown> = Promise.resolve();
  private artifactReservations = new Map<string, number>();
  constructor(private readonly options: BackgroundServiceOptions) {
    super(); this.artifacts = new ArtifactStore(options.repository);
  }
  async context(organizationId: string | null): Promise<BackgroundState> {
    const generation = this.generation;
    const scope = await this.options.resolveScope(organizationId);
    if (generation !== this.generation) throw new Error('La sesión cambió.');
    if (this.scope && sameBackgroundScope(this.scope, scope)) {
      await this.options.authorize(scope);
      if (generation !== this.generation) throw new Error('El contexto cambió.');
      return this.state();
    }
    this.invalidate();
    const jobs = this.options.repository.load(scope);
    for (const job of jobs) {
      if (isActiveBackgroundJob(job)) { job.status = 'interrupted'; job.error = 'El proceso se interrumpió. Puedes reanudar los pasos pendientes.'; }
      job.agents.forEach(agent => { if (agent.status === 'running') agent.status = 'pending'; });
      job.actions.forEach(action => { if (action.status === 'running') action.status = 'cancelled'; });
    }
    this.scope = scope; this.jobs = jobs; this.persist(); this.emit('changed');
    return this.state();
  }
  state(): BackgroundState {
    if (!this.scope) throw new Error('Selecciona un contexto autenticado.');
    const jobs = structuredClone(this.jobs);
    const active = this.active;
    for (const job of jobs) if (active?.id === job.id && isActiveBackgroundJob(job)) job.activeMs += Math.max(0, Date.now() - active.startedAt);
    return { scope: { ...this.scope }, jobs, persistence: 'encrypted' as const };
  }
  async authorize(): Promise<void> {
    if (!this.scope) throw new Error('Contexto no disponible.');
    const scope = this.scope; const generation = this.generation;
    await this.options.authorize(scope);
    if (generation !== this.generation || this.scope !== scope) throw new Error('La sesión cambió.');
  }
  contextToken(): number { return this.generation; }
  invalidate(): void {
    if (this.active) this.active.controller.abort();
    for (const job of this.jobs) if (isActiveBackgroundJob(job)) {
      job.status = 'interrupted'; job.error = 'La sesión o el contexto dejaron de estar disponibles.';
      job.agents.forEach(agent => { if (agent.status === 'running') agent.status = 'pending'; });
    }
    try { if (this.scope) this.persist(); } catch { /* Se mantiene la denegación aunque el almacenamiento falle. */ }
    this.generation++; this.scope = null; this.jobs = []; this.emit('changed');
  }
  private persist(): void { if (this.scope) this.options.repository.save(this.scope, this.jobs); }
  private changed(job: BackgroundJob): void {
    job.updatedAt = new Date().toISOString(); job.sequence++; this.persist(); this.emit('changed');
  }
  async start(input: BackgroundStart): Promise<BackgroundJob> {
    const operation = this.admissions.then(async () => {
      const parsed = startSchema.parse(input);
      if (/\b(pdf|env[ií]a|publica|borra|elimina|compra|paga|controla la pantalla)\b/i.test(parsed.task)) throw new Error('Ese formato o efecto necesita el flujo supervisado del chat.');
      await this.authorize();
      const scope = this.scope!;
      const generation = this.generation;
      if (parsed.expectedOwnerId !== scope.userId || parsed.expectedOrganizationId !== scope.organizationId) throw new Error('El contexto del encargo cambió.');
      const previous = this.jobs.find(job => job.requestId === parsed.requestId);
      if (previous) return structuredClone(previous);
      if (this.jobs.filter(isActiveBackgroundJob).length >= BACKGROUND_LIMITS.admitted) throw new Error('La cola de equipos está llena.');
      const plan = selectTeam({ task: parsed.task, surface: 'chat', mode: 'team' });
      if (!plan) throw new Error('Este encargo debe resolverse en modo directo.');
      const agent = (role: string, instruction: string): BackgroundAgent => ({ role, instruction, status: 'pending', operation: 'Pendiente', output: '', calls: 0 });
      const job: BackgroundJob = {
        ...parsed, id: randomUUID(), scope: { ...scope }, status: 'queued',
        allowResearch: parsed.allowResearch && !/\b(?:sin|no)\s+(?:investig\w*|busc\w*|consult\w*)\b/i.test(parsed.task),
        agents: plan.roles.slice(0, BACKGROUND_LIMITS.workers).map((role, index) => agent('especialista-' + (index ? 'dos' : 'uno'),
          role.instruction + ' Investiga si el encargo lo requiere y tienes research_web. Escribe tu aporte sustantivo en un archivo md independiente.')),
        artifacts: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), sequence: 1,
        calls: 0, tools: 0, tokens: 0, activeMs: 0, summary: '', error: null, sources: [], actions: [],
      };
      job.agents.push(agent('coordinador', 'Lee los aportes y abre los archivos de ambos especialistas. Contrasta y corrige discrepancias. Crea el entregable final pedido: Word para documentos, PowerPoint para presentaciones, Excel para tablas o presupuestos cuando se soliciten. Si el encargo solo pide ideas, guarda la síntesis en Markdown. Lee cada entregable para comprobarlo. No afirmes verificar referencias o presentación visual que no comprobaste. Tu respuesta final es la síntesis de SofLIA para el chat: explica en dos a cuatro frases qué realizaste y qué archivos quedaron disponibles. No enumeres agentes, operaciones internas, tokens, identificadores ni enlaces artifact://. Explica brevemente cualquier limitación real.'));
      // Resolver el proveedor antes de admitir; una clave faltante no deja trabajos fingiendo estar activos.
      await this.options.provider(job); await this.authorize();
      if (generation !== this.generation || scope !== this.scope) throw new Error('El contexto cambió durante la admisión.');
      while (this.jobs.length >= BACKGROUND_LIMITS.history) {
        const removable = this.jobs.findIndex(item => ['completed', 'cancelled'].includes(item.status));
        if (removable < 0) throw new Error('Conserva o cancela trabajos anteriores antes de iniciar otro.');
      this.jobs.splice(removable, 1);
      }
      this.jobs.push(job);
      try { this.persist(); } catch (error) { this.jobs.pop(); throw error; }
      this.emit('changed'); this.pump();
      return structuredClone(job);
    });
    this.admissions = operation.catch(() => undefined);
    return operation;
  }
  private pump(): void {
    if (this.active || !this.scope) return;
    const job = this.jobs.find(item => item.status === 'queued');
    if (!job) return;
    const controller = new AbortController(); const generation = this.generation;
    // Reservar antes de la primera espera evita ejecuciones solapadas.
    const active = { id: job.id, controller, promise: Promise.resolve(), startedAt: Date.now() };
    this.active = active;
    active.promise = this.execute(job, controller, generation).finally(() => {
      if (this.active === active) this.active = null;
      this.pump();
    });
  }
  private async execute(job: BackgroundJob, controller: AbortController, generation: number): Promise<void> {
    const started = Date.now();
    const timer = setTimeout(() => controller.abort(), Math.max(1, BACKGROUND_LIMITS.timeoutMs - job.activeMs));
    const guard = async () => {
      assertExecuting(controller.signal);
      if (generation !== this.generation || !this.scope || !sameBackgroundScope(job.scope, this.scope)) throw new Error('El contexto cambió.');
      if (job.tokens > BACKGROUND_LIMITS.tokens) throw new Error('Se agotó el presupuesto del trabajo.');
      await this.authorize(); assertExecuting(controller.signal);
    };
    try {
      await guard(); job.status = 'running'; job.error = null; this.changed(job);
      const provider = await this.options.provider(job);
      const beforeCall = async (agent: BackgroundAgent) => {
        await guard();
        if (job.calls >= BACKGROUND_LIMITS.calls || job.tokens >= BACKGROUND_LIMITS.tokens) throw new Error('Se agotó el presupuesto del trabajo.');
        job.calls++; agent.calls++; this.changed(job);
      };
      const usage = (tokens: number) => {
        if (generation !== this.generation || controller.signal.aborted) return;
        job.tokens += Math.max(0, Math.ceil(tokens)); this.changed(job);
        if (job.tokens > BACKGROUND_LIMITS.tokens) throw new Error('Se agotó el presupuesto del trabajo.');
      };
      const run = async (agent: BackgroundAgent) => {
        if (agent.status === 'completed') {
          for (const artifact of job.artifacts.filter(item => item.role === agent.role)) { await guard(); await this.artifacts.read(job, artifact); }
          return;
        }
        await guard(); agent.status = 'running'; agent.operation = 'Preparando ejecución'; this.changed(job);
        const tools = toolsForAgent(agent.role, job.allowResearch);
        agent.output = await provider.execute({ job: { ...structuredClone(job), effort: agent.role === 'coordinador' ? job.effort : 'medium' }, agent: { ...agent }, signal: controller.signal, tools,
          beforeCall: () => beforeCall(agent), usage,
          callTool: async (name, args) => {
            await guard();
            if (job.tools >= BACKGROUND_LIMITS.tools) throw new Error('Se agotó el presupuesto de herramientas.');
            job.tools++; agent.operation = name; this.changed(job);
            if (!tools.some(tool => tool.name === name) || !(name in toolSchemas)) throw new Error('Herramienta no autorizada.');
            const action: BackgroundAction = { id: randomUUID(), role: agent.role, tool: name, status: 'running', at: new Date().toISOString() };
            job.actions.push(action); this.changed(job);
            try {
              const parsed = toolSchemas[name as keyof typeof toolSchemas].parse(args);
              if (name === 'read_source') return JSON.stringify({ solicitud: job.task, fuenteNoConfiable: job.source });
              if (name === 'read_outputs') return JSON.stringify({ aportes: job.agents.filter(item => item.role !== agent.role).map(item => ({ role: item.role, output: item.output })), archivos: job.artifacts, fuentes: job.sources });
              if (name === 'read_artifact' && 'artifactId' in parsed) {
                const id = parsed.artifactId.replace(/^artifact:\/\//i, '');
                const artifact = job.artifacts.find(item => item.id === id);
                if (!artifact) throw new Error('Archivo fuera del trabajo.');
                action.artifactId = artifact.id;
                const text = await this.artifacts.read(job, artifact); await guard(); return text;
              }
              if (name === 'research_web' && 'query' in parsed) {
                await beforeCall(agent);
                const result = await provider.research(parsed.query, controller.signal); await guard(); usage(result.tokens);
                const research = JSON.parse(result.text) as { fuentes?: Array<{ uri?: unknown; title?: unknown }> };
                const sources = (research.fuentes ?? []).flatMap(source => {
                  if (typeof source.uri !== 'string' || source.uri.length > 2000) return [];
                  try { const url = new URL(source.uri); if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return []; } catch { return []; }
                  return [{ uri: source.uri, title: typeof source.title === 'string' ? source.title.slice(0, 180) : '', role: agent.role }];
                });
                if (!sources.length) throw new Error('No hay fuentes observadas.');
                for (const source of sources) if (job.sources.length < 50 && !job.sources.some(item => item.uri === source.uri)) job.sources.push(source);
                this.changed(job); return result.text;
              }
              const pending = this.artifactReservations.get(job.id) ?? 0;
              const hasNamed = 'name' in parsed && job.artifacts.some(item => item.role === agent.role && item.name === parsed.name);
              if (job.artifacts.length + pending >= BACKGROUND_LIMITS.artifacts && !hasNamed) throw new Error('Se agotó el límite de archivos.');
              this.artifactReservations.set(job.id, pending + 1);
              try {
                const kind = name === 'create_presentation' ? 'slides' : name === 'create_spreadsheet' ? 'sheet' : 'text';
                const artifact = await this.artifacts.create(job, agent.role, kind, parsed, guard);
                action.artifactId = artifact.id;
                await guard();
                if (!job.artifacts.some(item => item.id === artifact.id)) job.artifacts.push(artifact);
                this.changed(job);
                return JSON.stringify(artifact);
              } finally { this.artifactReservations.set(job.id, Math.max(0, (this.artifactReservations.get(job.id) ?? 1) - 1)); }
            } catch {
              action.status = 'failed';
              await guard();
              return JSON.stringify({ success: false, error: name === 'read_artifact' ? 'Usa el id UUID exacto de un archivo de read_outputs o de write_artifact. No uses nombres, rutas ni identificadores inventados. El archivo debe pertenecer a este trabajo.'
                : 'La herramienta no pudo completar la operación. Comprueba esquema, fuentes, destino, formato y presupuesto; no declares éxito.' });
            } finally {
              if (action.status === 'running') action.status = controller.signal.aborted ? 'cancelled' : 'completed';
              if (generation === this.generation) this.changed(job);
            }
          },
        });
        await guard();
        if (!job.artifacts.some(item => item.role === agent.role && item.verified)) throw new Error('El agente no produjo un archivo comprobado.');
        agent.status = 'completed'; agent.operation = 'Archivo comprobado'; this.changed(job);
      };
      const workers = await Promise.allSettled(job.agents.slice(0, 2).map(async agent => {
        try { await run(agent); } catch (error) {
          if (!controller.signal.aborted && generation === this.generation) { agent.status = 'failed'; agent.operation = 'No completado'; this.changed(job); }
          throw error;
        }
      }));
      await guard();
      if (workers.some(result => result.status === 'rejected')) throw new Error('Un especialista no completó su entregable.');
      await run(job.agents[2]); await guard();
      for (const worker of job.agents.slice(0, 2)) {
        if (!job.actions.some(action => action.role === 'coordinador' && action.tool === 'read_artifact' && action.status === 'completed'
          && job.artifacts.some(file => file.id === action.artifactId && file.role === worker.role))) throw new Error('Falta revisar el archivo de un especialista.');
      }
      job.status = 'verifying'; this.changed(job);
      const finalTexts: string[] = [];
      for (const artifact of job.artifacts) {
        const text = await this.artifacts.read(job, artifact); await guard();
        if (artifact.role === 'coordinador') finalTexts.push(text);
      }
      if (job.allowResearch && /\b(investiga\w*|referencias verificables|fuentes web|fuentes actuales)\b/i.test(job.task)) {
        const match = /\b([1-9]|dos|tres|cuatro|cinco)\s+(?:referencias|fuentes)\b/i.exec(job.task);
        const numbers: Record<string, number> = { dos: 2, tres: 3, cuatro: 4, cinco: 5 };
        const required = match ? numbers[match[1].toLowerCase()] ?? Number(match[1]) : 1;
        const cited = job.sources.filter(source => finalTexts.some(text => text.includes(source.uri)));
        if (cited.length < required) throw new Error('Falta la investigación y sus referencias en el entregable.');
      }
      const formats = job.artifacts.filter(item => item.role === 'coordinador').map(item => item.format);
      if (/\b(pptx|powerpoint|presentaci[oó]n|diapositivas)\b/i.test(job.task) && !formats.includes('pptx')) throw new Error('Falta la presentación solicitada.');
      if (/\b(excel|xlsx|hoja de c[aá]lculo)\b/i.test(job.task) && !formats.includes('xlsx')) throw new Error('Falta la hoja solicitada.');
      if (/\b(word|docx|documento|informe|reporte)\b/i.test(job.task) && !/\b(markdown|md|txt)\b/i.test(job.task) && !formats.includes('docx')) throw new Error('Falta el documento solicitado.');
      job.summary = job.agents[2].output; job.status = 'completed';
    } catch (error) {
      if (generation !== this.generation) return;
      if (job.status !== 'paused' && job.status !== 'cancelled') {
        job.status = 'failed';
        if (job.agents[2].status === 'completed') job.agents[2].status = 'pending';
        const message = error instanceof Error ? error.message : '';
        job.error = /^(Se agotó|Falta|Un especialista|El agente)/.test(message) ? message.slice(0, 300)
          : controller.signal.aborted ? 'Se agotó el tiempo activo. Se conservan los archivos comprobados.' : 'El equipo no completó todos los requisitos. Se conservan los archivos y puedes reanudar con el presupuesto restante.';
      }
      job.agents.forEach(agent => { if (agent.status === 'running') agent.status = 'pending'; });
    } finally {
      clearTimeout(timer);
      if (generation === this.generation && this.scope) {
        job.activeMs += Date.now() - started;
        try { this.changed(job); } catch { job.status = 'interrupted'; job.error = 'No se pudo guardar el último estado del trabajo.'; this.emit('changed'); }
      }
    }
  }
  async control(id: string, action: 'pause' | 'resume' | 'cancel'): Promise<BackgroundJob> {
    await this.authorize();
    const job = this.jobs.find(item => item.id === id);
    if (!job) throw new Error('Trabajo no disponible.');
    const generation = this.generation;
    if (action === 'resume' && this.active?.id === id) {
      await this.active.promise;
      await this.authorize();
      if (generation !== this.generation || !this.jobs.includes(job)) throw new Error('El contexto cambió durante la reanudación.');
    }
    if (action === 'resume') {
      if (!['paused', 'failed', 'interrupted'].includes(job.status)) throw new Error('El trabajo no puede reanudarse.');
      if (job.calls >= BACKGROUND_LIMITS.calls || job.activeMs >= BACKGROUND_LIMITS.timeoutMs || job.tokens >= BACKGROUND_LIMITS.tokens) throw new Error('El presupuesto del trabajo está agotado.');
      if (this.jobs.filter(isActiveBackgroundJob).length >= BACKGROUND_LIMITS.admitted) throw new Error('La cola de equipos está llena.');
      job.agents.forEach(agent => { if (agent.status === 'failed') agent.status = 'pending'; });
      job.status = 'queued'; job.error = null;
    } else {
      if (job.status === 'completed' || job.status === 'cancelled') throw new Error('El trabajo ya terminó.');
      job.status = action === 'pause' ? 'paused' : 'cancelled';
      if (this.active?.id === id) this.active.controller.abort();
    }
    this.changed(job); this.pump(); return structuredClone(job);
  }
  async artifactFile(jobId: string, artifactId: string): Promise<string> {
    await this.authorize();
    const job = this.jobs.find(item => item.id === jobId);
    const artifact = job?.artifacts.find(item => item.id === artifactId && item.verified);
    if (!job || !artifact) throw new Error('Archivo no disponible.');
    await this.artifacts.read(job, artifact); await this.authorize();
    return this.artifacts.file(job, artifact);
  }
  async attachLegacy(input: { jobId: string; messageId: string; conversationId: string }): Promise<void> {
    await this.authorize();
    const generation = this.generation;
    const job = this.jobs.find(item => item.id === input.jobId);
    if (!job || job.messageId || !job.conversationId.startsWith('borrador:') || !this.options.verifyLegacyBinding) throw new Error('El vínculo no puede cambiarse.');
    await this.options.verifyLegacyBinding(job, input);
    await this.authorize();
    if (generation !== this.generation || !this.jobs.includes(job) || job.messageId) throw new Error('El contexto cambió.');
    job.messageId = input.messageId; job.conversationId = input.conversationId; this.changed(job);
  }
  async idle(): Promise<void> {
    while (this.active) await this.active.promise;
  }
  close(): void { this.invalidate(); this.removeAllListeners(); }
}

