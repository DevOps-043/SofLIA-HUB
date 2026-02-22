/**
 * AutoDevService — Autonomous self-programming system with multi-agent architecture.
 *
 * Core principle: RESEARCH BEFORE IMPLEMENTING.
 *
 * Agents (run in parallel where possible):
 *   1. Security Agent     (gemini-3-flash-preview + googleSearch) — CVEs, OWASP, advisories
 *   2. Dependencies Agent (gemini-3-flash-preview + googleSearch) — npm audit, outdated, changelogs
 *   3. Quality Agent      (gemini-3-flash-preview + googleSearch) — best practices, patterns
 *   4. Coder Agent 1      (gemini-3.1-pro-preview-customtools)   — analyze + implement files batch 1
 *   5. Coder Agent 2      (gemini-3.1-pro-preview-customtools)   — analyze + implement files batch 2
 *   6. Reviewer Agent     (gemini-3-flash-preview)               — self-review all diffs
 *   7. Tester Agent       (gemini-3-flash-preview)               — build verification + test suggestions
 *   8. Summary Agent      (gemini-3-flash-preview)               — WhatsApp summary generation
 *
 * Parallel execution flow:
 *   Phase 1 (parallel): [SecurityAgent] [DepsAgent] [QualityAgent] [NpmAudit] [ReadFiles]
 *   Phase 2 (parallel): [CoderAgent1 batch1] [CoderAgent2 batch2]
 *   Phase 3 (parallel): [ReviewerAgent] [TesterAgent]
 *   Phase 4 (sequential): commit → push → PR → notify
 */
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { app, powerMonitor } from 'electron';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { CronJob } from 'cron';

import {
  type AutoDevConfig,
  type AutoDevRun,
  type AutoDevImprovement,
  type ResearchFinding,
  type AutoDevRunStatus,
  type AgentTask,
  DEFAULT_CONFIG,
} from './autodev-types';
import { AutoDevGit } from './autodev-git';
import { webSearch, readWebpage, npmAudit, npmOutdated } from './autodev-web';
import {
  RESEARCH_GROUNDING_PROMPT,
  ANALYZE_PROMPT,
  PLAN_PROMPT,
  CODE_PROMPT,
  REVIEW_PROMPT,
  SUMMARY_PROMPT,
  NPM_ANALYSIS_PROMPT,
} from './autodev-prompts';

// ─── Constants ─────────────────────────────────────────────────────

const CONFIG_PATH = path.join(app.getPath('userData'), 'autodev-config.json');
const HISTORY_PATH = path.join(app.getPath('userData'), 'autodev-history.json');
const MAX_HISTORY_RUNS = 50;
const IGNORE_DIRS = ['node_modules', 'dist', 'dist-electron', '.git', 'build', 'coverage', 'SofLIA - Extension'];

// ─── Tool declarations for function calling agents ─────────────────

const RESEARCH_TOOLS = [
  {
    name: 'web_search',
    description: 'Search the web for information about packages, vulnerabilities, best practices, documentation.',
    parameters: {
      type: 'object' as const,
      properties: { query: { type: 'string', description: 'Search query' } },
      required: ['query'],
    },
  },
  {
    name: 'read_webpage',
    description: 'Read and extract text content from a URL (documentation, changelogs, advisories).',
    parameters: {
      type: 'object' as const,
      properties: { url: { type: 'string', description: 'URL to read' } },
      required: ['url'],
    },
  },
  {
    name: 'read_file',
    description: 'Read a file from the project for additional context.',
    parameters: {
      type: 'object' as const,
      properties: { path: { type: 'string', description: 'Relative path to the file' } },
      required: ['path'],
    },
  },
];

// ─── Parallel execution helper ─────────────────────────────────────

async function runParallel<T>(
  tasks: Array<{ name: string; fn: () => Promise<T> }>,
  maxConcurrency: number,
  onTaskDone?: (name: string, result: T) => void,
): Promise<Map<string, T>> {
  const results = new Map<string, T>();
  const queue = [...tasks];

  const runNext = async (): Promise<void> => {
    const task = queue.shift();
    if (!task) return;
    try {
      console.log(`[AutoDev Agent] Starting: ${task.name}`);
      const result = await task.fn();
      results.set(task.name, result);
      onTaskDone?.(task.name, result);
      console.log(`[AutoDev Agent] Completed: ${task.name}`);
    } catch (err: any) {
      console.error(`[AutoDev Agent] Failed: ${task.name} — ${err.message}`);
      results.set(task.name, [] as any);
    }
    await runNext();
  };

  const workers = Array.from(
    { length: Math.min(maxConcurrency, tasks.length) },
    () => runNext(),
  );
  await Promise.all(workers);
  return results;
}

// ─── AutoDevService ────────────────────────────────────────────────

export class AutoDevService extends EventEmitter {
  private config: AutoDevConfig;
  private apiKey: string = '';
  private genAI: GoogleGenerativeAI | null = null;
  private git: AutoDevGit;
  private repoPath: string;
  private cronJob: CronJob | null = null;
  private currentRun: AutoDevRun | null = null;
  private abortController: AbortController | null = null;
  private history: AutoDevRun[] = [];
  private todayRunCount: number = 0;
  private todayDate: string = '';
  private researchQueryCount: number = 0;

  constructor(repoPath: string) {
    super();
    this.repoPath = repoPath;
    this.config = this.loadConfig();
    this.git = new AutoDevGit(repoPath);
    this.history = this.loadHistory();
  }

  // ─── API Key ───────────────────────────────────────────────────

  setApiKey(key: string): void {
    this.apiKey = key;
    this.genAI = null;
  }

  private getGenAI(): GoogleGenerativeAI {
    if (!this.apiKey) throw new Error('Gemini API key not set');
    if (!this.genAI) this.genAI = new GoogleGenerativeAI(this.apiKey);
    return this.genAI;
  }

  // ─── Config persistence ────────────────────────────────────────

  private loadConfig(): AutoDevConfig {
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        const data = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
        return { ...DEFAULT_CONFIG, ...data, agents: { ...DEFAULT_CONFIG.agents, ...data.agents } };
      }
    } catch { /* defaults */ }
    return { ...DEFAULT_CONFIG };
  }

  private saveConfig(): void {
    try {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(this.config, null, 2), 'utf-8');
    } catch (err: any) {
      console.error('[AutoDev] Error saving config:', err.message);
    }
  }

  getConfig(): AutoDevConfig { return { ...this.config }; }

  updateConfig(updates: Partial<AutoDevConfig>): AutoDevConfig {
    this.config = { ...this.config, ...updates };
    this.saveConfig();
    if (updates.cronSchedule || updates.enabled !== undefined) {
      this.stop();
      if (this.config.enabled) this.start();
    }
    this.emit('config-updated', this.config);
    return this.config;
  }

  // ─── History ───────────────────────────────────────────────────

  private loadHistory(): AutoDevRun[] {
    try {
      if (fs.existsSync(HISTORY_PATH)) return JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf-8'));
    } catch { /* empty */ }
    return [];
  }

  private saveHistory(): void {
    try {
      if (this.history.length > MAX_HISTORY_RUNS) this.history = this.history.slice(-MAX_HISTORY_RUNS);
      fs.writeFileSync(HISTORY_PATH, JSON.stringify(this.history, null, 2), 'utf-8');
    } catch (err: any) {
      console.error('[AutoDev] Error saving history:', err.message);
    }
  }

  getHistory(): AutoDevRun[] { return [...this.history]; }

  getStatus() {
    return {
      running: !!this.currentRun,
      currentRun: this.currentRun ? { ...this.currentRun } : null,
      config: this.getConfig(),
      todayRunCount: this.todayRunCount,
      cronActive: !!this.cronJob,
    };
  }

  // ─── Lifecycle ─────────────────────────────────────────────────

  async start(): Promise<void> {
    if (!this.config.enabled) return;
    try {
      const { CronJob } = await import('cron');
      this.cronJob = new CronJob(this.config.cronSchedule, () => this.scheduledRun(), null, true);
      console.log(`[AutoDev] Cron started: ${this.config.cronSchedule}`);
    } catch (err: any) {
      console.error('[AutoDev] Failed to start cron:', err.message);
    }
  }

  stop(): void {
    if (this.cronJob) { this.cronJob.stop(); this.cronJob = null; }
  }

  abort(): void {
    if (this.abortController) { this.abortController.abort(); console.log('[AutoDev] Aborted.'); }
  }

  isRunning(): boolean { return !!this.currentRun; }

  private async scheduledRun(): Promise<void> {
    if (powerMonitor.getSystemIdleTime() < 300) return;
    await this.runNow();
  }

  // ─── Manual run ────────────────────────────────────────────────

  async runNow(): Promise<AutoDevRun> {
    if (this.currentRun) throw new Error('A run is already in progress');
    if (!this.apiKey) throw new Error('Gemini API key not configured');

    const today = new Date().toISOString().split('T')[0];
    if (this.todayDate !== today) { this.todayDate = today; this.todayRunCount = 0; }
    if (this.todayRunCount >= this.config.maxDailyRuns) throw new Error(`Daily limit reached (${this.config.maxDailyRuns})`);

    this.todayRunCount++;
    this.researchQueryCount = 0;

    const run: AutoDevRun = {
      id: `run_${Date.now()}`,
      startedAt: new Date().toISOString(),
      status: 'researching',
      improvements: [],
      researchFindings: [],
      agentTasks: [],
      summary: '',
    };

    this.currentRun = run;
    this.abortController = new AbortController();
    this.emit('run-started', run);

    try {
      await this.executeRun(run);
    } catch (err: any) {
      run.status = this.abortController?.signal.aborted ? 'aborted' : 'failed';
      run.error = err.message;
      if (run.branchName) {
        try { await this.git.cleanupBranch(run.branchName); } catch { /* best effort */ }
      }
    } finally {
      run.completedAt = new Date().toISOString();
      this.history.push(run);
      this.saveHistory();
      this.currentRun = null;
      this.abortController = null;
      this.emit('run-completed', run);
    }
    return run;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  CORE MULTI-AGENT LOOP
  // ═══════════════════════════════════════════════════════════════════

  private async executeRun(run: AutoDevRun): Promise<void> {
    const checkAbort = () => { if (this.abortController!.signal.aborted) throw new Error('Aborted'); };

    // ─── Validate ────────────────────────────────────────────────
    this.updateRunStatus(run, 'researching');
    if (!await this.git.hasRemote()) throw new Error('No git remote configured');
    if (!await this.git.isGhAuthenticated()) throw new Error('GitHub CLI not authenticated (run: gh auth login)');
    checkAbort();

    // ═══════════════════════════════════════════════════════════════
    //  PHASE 1: PARALLEL RESEARCH (up to 5 agents + npm simultaneously)
    // ═══════════════════════════════════════════════════════════════
    console.log('[AutoDev] ═══ Phase 1: Parallel Research ═══');

    const depsList = this.getDependenciesList();
    const sourceCode = await this.readProjectFiles();
    if (!sourceCode.length) throw new Error('No source files found');
    const sourceContext = sourceCode.map(f => `--- ${f.path} ---\n${f.content}`).join('\n\n');

    // Launch ALL research agents + npm audit in parallel
    const researchTasks = [
      {
        name: 'SecurityAgent',
        fn: () => this.runResearchAgent('security', depsList,
          'Busca CVEs, security advisories, vulnerabilidades OWASP para las dependencias. Prioriza vulnerabilidades críticas y altas.'),
      },
      {
        name: 'DependenciesAgent',
        fn: () => this.runResearchAgent('dependencies', depsList,
          'Busca versiones nuevas de dependencias, changelogs importantes, breaking changes. Identifica paquetes significativamente desactualizados.'),
      },
      {
        name: 'QualityAgent',
        fn: () => this.runResearchAgent('quality', depsList,
          'Busca best practices actuales para Electron, React 19, TypeScript 5.7, Vite. Identifica patrones modernos recomendados.'),
      },
      {
        name: 'NpmAudit',
        fn: async () => {
          const [audit, outdated] = await Promise.all([npmAudit(this.repoPath), npmOutdated(this.repoPath)]);
          return { audit, outdated };
        },
      },
    ];

    // Only add agents for enabled categories
    const filteredTasks = researchTasks.filter(t => {
      if (t.name === 'NpmAudit') return true;
      const cat = t.name.replace('Agent', '').toLowerCase();
      return this.config.categories.some(c => cat.includes(c));
    });

    const phase1Results = await runParallel(filteredTasks, this.config.maxParallelAgents,
      (name, _result) => { this.trackAgent(run, name, 'research', 'completed'); });

    checkAbort();

    // Collect all research findings
    for (const [name, result] of phase1Results) {
      if (name === 'NpmAudit') continue;
      if (Array.isArray(result)) {
        run.researchFindings.push(...(result as ResearchFinding[]));
      }
    }

    const npmData = phase1Results.get('NpmAudit') as any || { audit: { vulnerabilities: [] }, outdated: { packages: [] } };
    const npmAuditText = JSON.stringify((npmData.audit?.vulnerabilities || []).slice(0, 20), null, 2);
    const npmOutdatedText = JSON.stringify((npmData.outdated?.packages || []).slice(0, 30), null, 2);

    // ═══════════════════════════════════════════════════════════════
    //  PHASE 1.5: AGENTIC DEEP RESEARCH (coding model with tools)
    // ═══════════════════════════════════════════════════════════════
    console.log('[AutoDev] ═══ Phase 1.5: Deep Agentic Research ═══');

    const deepFindings = await this.runAgenticResearch(
      sourceContext.slice(0, 50000),
      npmAuditText, npmOutdatedText,
      run.researchFindings,
    );
    run.researchFindings.push(...deepFindings);
    this.trackAgent(run, 'DeepResearcher', 'research', 'completed');
    checkAbort();

    // ═══════════════════════════════════════════════════════════════
    //  PHASE 2: PARALLEL ANALYSIS + PLANNING (coding agents)
    // ═══════════════════════════════════════════════════════════════
    console.log('[AutoDev] ═══ Phase 2: Analysis + Planning ═══');
    this.updateRunStatus(run, 'analyzing');

    const improvements = await this.analyzeCode(sourceContext, run.researchFindings, npmAuditText, npmOutdatedText);
    if (!improvements.length) {
      run.status = 'completed';
      run.summary = 'No actionable improvements found after research.';
      return;
    }
    this.trackAgent(run, 'Analyzer', 'coding', 'completed');
    checkAbort();

    this.updateRunStatus(run, 'planning');
    const plan = await this.generatePlan(improvements, run.researchFindings);
    if (!plan.length) {
      run.status = 'completed';
      run.summary = 'Plan generation produced no actionable steps.';
      return;
    }
    this.trackAgent(run, 'Planner', 'coding', 'completed');
    checkAbort();

    // ═══════════════════════════════════════════════════════════════
    //  PHASE 3: PARALLEL CODING (multiple coder agents on different files)
    // ═══════════════════════════════════════════════════════════════
    console.log('[AutoDev] ═══ Phase 3: Parallel Coding ═══');
    this.updateRunStatus(run, 'coding');

    const branchName = `autodev/${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16)}`;
    run.branchName = await this.git.createWorkBranch(branchName);

    // Split plan into batches for parallel coding agents
    const coderConcurrency = this.config.agents.coder.concurrency;
    const batchSize = Math.ceil(plan.length / coderConcurrency);
    const codingTasks = [];

    for (let i = 0; i < coderConcurrency && i * batchSize < plan.length; i++) {
      const batch = plan.slice(i * batchSize, (i + 1) * batchSize);
      const agentName = `CoderAgent_${i + 1}`;
      codingTasks.push({
        name: agentName,
        fn: async () => {
          const results: AutoDevImprovement[] = [];
          for (const step of batch) {
            checkAbort();
            try {
              const result = await this.implementStep(step);
              if (result) {
                result.agentRole = agentName;
                results.push(result);
              }
            } catch (err: any) {
              console.warn(`[AutoDev ${agentName}] Step failed (${step.file}): ${err.message}`);
            }
          }
          return results;
        },
      });
    }

    // NOTE: Coding agents run sequentially to avoid file conflicts
    // (parallel file writes on same repo can cause issues)
    for (const task of codingTasks) {
      checkAbort();
      try {
        const results = await task.fn();
        run.improvements.push(...results);
        this.trackAgent(run, task.name, 'coding', 'completed');
      } catch (err: any) {
        this.trackAgent(run, task.name, 'coding', 'failed', err.message);
      }
    }

    if (!run.improvements.filter(i => i.applied).length) {
      run.status = 'failed';
      run.error = 'No improvements were successfully applied';
      await this.git.cleanupBranch(run.branchName);
      return;
    }

    // ═══════════════════════════════════════════════════════════════
    //  PHASE 4: PARALLEL REVIEW + BUILD (reviewer + tester agents)
    // ═══════════════════════════════════════════════════════════════
    console.log('[AutoDev] ═══ Phase 4: Parallel Review + Build ═══');
    this.updateRunStatus(run, 'verifying');

    await this.git.stageAll();

    const lineCount = await this.git.getDiffLineCount();
    if (lineCount > this.config.maxLinesChanged) {
      run.status = 'failed';
      run.error = `Changes exceed line limit: ${lineCount} > ${this.config.maxLinesChanged}`;
      await this.git.cleanupBranch(run.branchName);
      return;
    }

    const diff = await this.git.getFullDiff();

    // Run reviewer and tester in PARALLEL
    const [reviewResult, buildResult] = await Promise.all([
      this.selfReview(diff, run.improvements, run.researchFindings),
      this.config.requireBuildPass ? this.verifyBuild() : Promise.resolve(true),
    ]);
    this.trackAgent(run, 'ReviewerAgent', 'review', 'completed');
    this.trackAgent(run, 'TesterAgent', 'testing', 'completed');

    if (!buildResult) {
      run.status = 'failed';
      run.error = 'Build failed after applying changes';
      await this.git.cleanupBranch(run.branchName);
      return;
    }

    if (reviewResult.decision === 'reject') {
      run.status = 'failed';
      run.error = `Self-review rejected: ${reviewResult.summary}`;
      await this.git.cleanupBranch(run.branchName);
      return;
    }
    checkAbort();

    // ═══════════════════════════════════════════════════════════════
    //  PHASE 5: COMMIT → PUSH → PR → NOTIFY (sequential)
    // ═══════════════════════════════════════════════════════════════
    console.log('[AutoDev] ═══ Phase 5: Commit + Push + PR ═══');
    this.updateRunStatus(run, 'pushing');

    await this.git.commitChanges(this.generateCommitMessage(run.improvements));
    await this.git.pushBranch(run.branchName);
    run.prUrl = await this.git.createPR(this.generatePRTitle(run.improvements), this.generatePRBody(run), this.config.targetBranch);
    await this.git.switchBranch(this.config.targetBranch);

    // Summary agent (flash — fast)
    run.summary = await this.generateSummary(run);
    this.trackAgent(run, 'SummaryAgent', 'review', 'completed');

    if (this.config.notifyWhatsApp && this.config.notifyPhone) {
      this.emit('notify-whatsapp', { phone: this.config.notifyPhone, message: run.summary });
    }

    run.status = 'completed';
    console.log(`[AutoDev] ═══ Run completed: ${run.improvements.filter(i => i.applied).length} improvements, PR: ${run.prUrl} ═══`);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  AGENT IMPLEMENTATIONS
  // ═══════════════════════════════════════════════════════════════════

  private trackAgent(run: AutoDevRun, name: string, role: string, status: 'completed' | 'failed', error?: string): void {
    run.agentTasks.push({
      id: `${name}_${Date.now()}`,
      agentRole: role,
      model: role === 'coding' ? this.config.agents.coder.model : this.config.agents.researcher.model,
      status,
      completedAt: new Date().toISOString(),
      description: name,
      error,
    });
    this.emit('agent-completed', { runId: run.id, agent: name, role, status });
  }

  private updateRunStatus(run: AutoDevRun, status: AutoDevRunStatus): void {
    run.status = status;
    this.emit('status-changed', { runId: run.id, status, agents: run.agentTasks.length });
  }

  // ─── Research Agent (flash + googleSearch grounding) ───────────

  private async runResearchAgent(
    category: string,
    depsList: string,
    focusPrompt: string,
  ): Promise<ResearchFinding[]> {
    try {
      const ai = this.getGenAI();
      const model = ai.getGenerativeModel({
        model: this.config.agents.researcher.model,
        tools: [{ googleSearch: {} } as any],
      });

      const prompt = RESEARCH_GROUNDING_PROMPT
        .replace('{DEPENDENCIES_LIST}', depsList)
        .replace('{CATEGORIES}', category)
        + `\n\n## FOCO ESPECÍFICO DE ESTE AGENTE\n${focusPrompt}`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const parsed = this.parseJSON(text);

      if (parsed?.findings) {
        return parsed.findings.map((f: any) => ({
          query: f.query || '',
          category: f.category || category,
          findings: f.findings || '',
          sources: f.sources || [],
          actionable: f.actionable ?? false,
          agentRole: `${category}Agent`,
        }));
      }
    } catch (err: any) {
      console.warn(`[AutoDev ${category}Agent] Error:`, err.message);
    }
    return [];
  }

  // ─── Agentic Deep Research (coding model + function calling) ───

  private async runAgenticResearch(
    codeContext: string,
    npmAuditText: string,
    npmOutdatedText: string,
    priorFindings: ResearchFinding[],
  ): Promise<ResearchFinding[]> {
    const findings: ResearchFinding[] = [];
    try {
      const ai = this.getGenAI();
      const model = ai.getGenerativeModel({
        model: this.config.agents.coder.model,
        tools: [{ functionDeclarations: RESEARCH_TOOLS }],
      });

      const priorContext = priorFindings
        .map(f => `- [${f.category}] ${f.findings} (sources: ${f.sources.join(', ')})`)
        .join('\n');

      const prompt = `Eres un investigador de software. Usa web_search y read_webpage para profundizar en las mejoras detectadas.

## Investigación previa (de agentes paralelos)
${priorContext || 'Ninguna'}

## npm audit
${npmAuditText}

## npm outdated
${npmOutdatedText}

## Código (fragmentos)
${codeContext.slice(0, 30000)}

## Categorías: ${this.config.categories.join(', ')}

## Instrucciones
1. Para cada hallazgo previo, busca más detalles: changelogs, fixes, migration guides
2. Verifica que las soluciones propuestas son correctas leyendo documentación oficial
3. Máximo ${this.config.maxResearchQueries} búsquedas web en total

Responde con JSON: { "findings": [{ "query": "...", "category": "...", "findings": "...", "sources": ["..."], "actionable": true/false }] }`;

      const chat = model.startChat();
      let response = await chat.sendMessage(prompt);
      let turns = 10;

      while (turns-- > 0) {
        const parts = response.response.candidates?.[0]?.content?.parts || [];
        const calls = parts.filter((p: any) => p.functionCall);
        if (!calls.length) break;

        const results: any[] = [];
        for (const part of calls) {
          const fc = (part as any).functionCall;
          results.push({ functionResponse: { name: fc.name, response: await this.executeResearchTool(fc.name, fc.args) } });
        }
        response = await chat.sendMessage(results);
      }

      const parsed = this.parseJSON(response.response.text());
      if (parsed?.findings) {
        for (const f of parsed.findings) {
          findings.push({
            query: f.query || '', category: f.category || 'quality',
            findings: f.findings || '', sources: f.sources || [],
            actionable: f.actionable ?? false, agentRole: 'DeepResearcher',
          });
        }
      }
    } catch (err: any) {
      console.warn('[AutoDev DeepResearcher] Error:', err.message);
    }
    return findings;
  }

  private async executeResearchTool(name: string, args: any): Promise<any> {
    this.researchQueryCount++;
    if (this.researchQueryCount > this.config.maxResearchQueries) {
      return { success: false, error: 'Research query limit reached' };
    }
    switch (name) {
      case 'web_search': {
        const r = await webSearch(args.query);
        return { success: r.success, result: r.results, error: r.error };
      }
      case 'read_webpage': {
        const r = await readWebpage(args.url);
        return { success: r.success, result: r.content, error: r.error };
      }
      case 'read_file': {
        try {
          const fp = path.resolve(this.repoPath, args.path);
          if (!fp.startsWith(this.repoPath)) return { success: false, error: 'Path outside repository' };
          return { success: true, result: fs.readFileSync(fp, 'utf-8').slice(0, 10000) };
        } catch (err: any) {
          return { success: false, error: err.message };
        }
      }
      default: return { success: false, error: `Unknown tool: ${name}` };
    }
  }

  // ─── Analysis (coding model) ──────────────────────────────────

  private async analyzeCode(sourceContext: string, findings: ResearchFinding[], npmAuditText: string, npmOutdatedText: string): Promise<any[]> {
    const ai = this.getGenAI();
    const model = ai.getGenerativeModel({
      model: this.config.agents.coder.model,
      tools: [{ functionDeclarations: RESEARCH_TOOLS }],
    });

    const findingsText = findings.filter(f => f.actionable)
      .map(f => `- [${f.category}] ${f.findings}\n  Sources: ${f.sources.join(', ')}`).join('\n');

    const prompt = ANALYZE_PROMPT
      .replace('{REPO_PATH}', this.repoPath)
      .replace('{RESEARCH_FINDINGS}', findingsText || 'No prior findings')
      .replace('{NPM_AUDIT}', npmAuditText)
      .replace('{NPM_OUTDATED}', npmOutdatedText)
      .replace('{SOURCE_CODE}', sourceContext.slice(0, 200000))
      .replace('{CATEGORIES}', this.config.categories.join(', '))
      .replace('{MAX_FILES}', String(this.config.maxFilesPerRun))
      .replace('{MAX_LINES}', String(this.config.maxLinesChanged));

    const chat = model.startChat();
    let response = await chat.sendMessage(prompt);
    let turns = 8;
    while (turns-- > 0) {
      const calls = (response.response.candidates?.[0]?.content?.parts || []).filter((p: any) => p.functionCall);
      if (!calls.length) break;
      const results: any[] = [];
      for (const part of calls) {
        const fc = (part as any).functionCall;
        results.push({ functionResponse: { name: fc.name, response: await this.executeResearchTool(fc.name, fc.args) } });
      }
      response = await chat.sendMessage(results);
    }

    return this.parseJSON(response.response.text())?.improvements || [];
  }

  // ─── Planning (coding model) ──────────────────────────────────

  private async generatePlan(improvements: any[], findings: ResearchFinding[]): Promise<any[]> {
    const ai = this.getGenAI();
    const model = ai.getGenerativeModel({ model: this.config.agents.coder.model });
    const ctx = findings.filter(f => f.actionable).map(f => `- [${f.category}] ${f.findings} (${f.sources.join(', ')})`).join('\n');

    const prompt = PLAN_PROMPT
      .replace('{IMPROVEMENTS}', JSON.stringify(improvements, null, 2))
      .replace('{RESEARCH_CONTEXT}', ctx || 'None')
      .replace('{MAX_LINES}', String(this.config.maxLinesChanged));

    const result = await model.generateContent(prompt);
    return this.parseJSON(result.response.text())?.plan || [];
  }

  // ─── Code implementation (coding model + tools) ───────────────

  private async implementStep(step: any): Promise<AutoDevImprovement | null> {
    const filePath = path.resolve(this.repoPath, step.file);
    if (!filePath.startsWith(this.repoPath)) return null;

    let currentCode = '';
    try { currentCode = fs.readFileSync(filePath, 'utf-8'); } catch {
      if (step.action !== 'create') return null;
    }

    const ai = this.getGenAI();
    const model = ai.getGenerativeModel({
      model: this.config.agents.coder.model,
      tools: [{ functionDeclarations: RESEARCH_TOOLS }],
    });

    const prompt = CODE_PROMPT
      .replace('{PLAN_STEP}', JSON.stringify(step, null, 2))
      .replace('{FILE_PATH}', step.file)
      .replace('{CURRENT_CODE}', currentCode)
      .replace('{RESEARCH_CONTEXT}', step.source || 'None');

    const chat = model.startChat();
    let response = await chat.sendMessage(prompt);
    let turns = 5;
    while (turns-- > 0) {
      const calls = (response.response.candidates?.[0]?.content?.parts || []).filter((p: any) => p.functionCall);
      if (!calls.length) break;
      const results: any[] = [];
      for (const part of calls) {
        const fc = (part as any).functionCall;
        results.push({ functionResponse: { name: fc.name, response: await this.executeResearchTool(fc.name, fc.args) } });
      }
      response = await chat.sendMessage(results);
    }

    const parsed = this.parseJSON(response.response.text());
    if (!parsed?.modifiedCode) return null;

    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, parsed.modifiedCode, 'utf-8');

    return {
      file: step.file, category: step.category || 'quality',
      description: parsed.changesDescription || step.description || '',
      applied: true, researchSources: parsed.sourcesConsulted || [step.source].filter(Boolean),
      agentRole: 'coder',
    };
  }

  // ─── Build verification (tester agent) ────────────────────────

  private async verifyBuild(): Promise<boolean> {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    try {
      await promisify(execFile)('npm', ['run', 'build'], {
        cwd: this.repoPath, timeout: 180_000, maxBuffer: 10 * 1024 * 1024, shell: true,
      });
      console.log('[AutoDev TesterAgent] Build passed.');
      return true;
    } catch (err: any) {
      console.error('[AutoDev TesterAgent] Build failed:', err.message);
      return false;
    }
  }

  // ─── Self-review (reviewer agent) ─────────────────────────────

  private async selfReview(diff: string, improvements: AutoDevImprovement[], findings: ResearchFinding[]): Promise<{ decision: string; summary: string }> {
    const ai = this.getGenAI();
    const model = ai.getGenerativeModel({ model: this.config.agents.reviewer.model });

    const sourcesText = findings.filter(f => f.actionable).map(f => `- ${f.findings}: ${f.sources.join(', ')}`).join('\n');
    const impText = improvements.filter(i => i.applied)
      .map(i => `- [${i.category}] ${i.file}: ${i.description} (sources: ${i.researchSources.join(', ')})`).join('\n');

    const prompt = REVIEW_PROMPT
      .replace('{DIFF}', diff.slice(0, 100000))
      .replace('{IMPROVEMENTS_APPLIED}', impText)
      .replace('{RESEARCH_SOURCES}', sourcesText || 'None');

    const result = await model.generateContent(prompt);
    const parsed = this.parseJSON(result.response.text());
    return { decision: parsed?.decision || 'reject', summary: parsed?.summary || 'Could not parse review' };
  }

  // ─── Summary (flash agent) ────────────────────────────────────

  private async generateSummary(run: AutoDevRun): Promise<string> {
    try {
      const ai = this.getGenAI();
      const model = ai.getGenerativeModel({ model: this.config.agents.researcher.model });

      const impText = run.improvements.filter(i => i.applied)
        .map(i => `- [${i.category}] ${i.file}: ${i.description}\n  Sources: ${i.researchSources.join(', ')}`).join('\n');
      const findText = run.researchFindings.filter(f => f.actionable)
        .map(f => `- [${f.category}] ${f.findings}`).join('\n');

      const prompt = SUMMARY_PROMPT
        .replace('{RUN_INFO}', JSON.stringify({
          id: run.id, agents: run.agentTasks.length,
          duration: run.completedAt ? `${Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 60000)} min` : 'in progress',
          status: run.status, branchName: run.branchName, prUrl: run.prUrl,
        }, null, 2))
        .replace('{IMPROVEMENTS}', impText || 'None')
        .replace('{RESEARCH_FINDINGS}', findText || 'None');

      return (await model.generateContent(prompt)).response.text().slice(0, 1500);
    } catch {
      const applied = run.improvements.filter(i => i.applied);
      return `🤖 AutoDev completado\n${run.agentTasks.length} agentes usados\n${applied.length} mejoras\n${run.prUrl || 'Sin PR'}`;
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────

  private readProjectFiles(): Array<{ path: string; content: string }> {
    const files: Array<{ path: string; content: string }> = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(this.repoPath, fullPath);
        if (entry.isDirectory()) {
          if (!IGNORE_DIRS.some(d => relPath.startsWith(d) || entry.name === d)) walk(fullPath);
          continue;
        }
        if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) continue;
        if (entry.name.endsWith('.d.ts')) continue;
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          if (content.length < 500000) files.push({ path: relPath.replace(/\\/g, '/'), content });
        } catch { /* skip */ }
      }
    };
    walk(this.repoPath);
    return files;
  }

  private getDependenciesList(): string {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(this.repoPath, 'package.json'), 'utf-8'));
      return Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })
        .map(([n, v]) => `${n}@${v}`).join('\n');
    } catch { return 'Could not read package.json'; }
  }

  private generateCommitMessage(improvements: AutoDevImprovement[]): string {
    const applied = improvements.filter(i => i.applied);
    const cats = [...new Set(applied.map(i => i.category))];
    return [
      `Automated improvements: ${cats.join(', ')}`,
      '', ...applied.map(i => `- [${i.category}] ${i.file}: ${i.description}`),
      '', `Files: ${[...new Set(applied.map(i => i.file))].length} | Sources: ${[...new Set(applied.flatMap(i => i.researchSources))].slice(0, 5).join(', ')}`,
    ].join('\n');
  }

  private generatePRTitle(improvements: AutoDevImprovement[]): string {
    const applied = improvements.filter(i => i.applied);
    const cats = [...new Set(applied.map(i => i.category))];
    return `${cats.join(', ')}: ${applied.length} automated improvements`;
  }

  private generatePRBody(run: AutoDevRun): string {
    const applied = run.improvements.filter(i => i.applied);
    const findings = run.researchFindings.filter(f => f.actionable);
    return [
      '## Summary',
      `AutoDev multi-agent run — ${run.agentTasks.length} agents deployed, ${applied.length} improvements applied.`,
      '',
      '## Agents Used',
      ...run.agentTasks.map(t => `- **${t.description}** (${t.model}) — ${t.status}`),
      '',
      '## Improvements',
      ...applied.map(i => `- **[${i.category}]** \`${i.file}\`: ${i.description}\n  Sources: ${i.researchSources.map(s => `[link](${s})`).join(', ') || 'N/A'}`),
      '',
      '## Research Conducted',
      ...findings.slice(0, 10).map(f => `- **[${f.category}]** ${f.findings}\n  Sources: ${f.sources.map(s => `[link](${s})`).join(', ')}`),
      '', '---', '🤖 Generated by AutoDev multi-agent system (SofLIA-HUB)',
    ].join('\n');
  }

  private parseJSON(text: string): any {
    const m = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
    if (m) { try { return JSON.parse(m[1]); } catch { /* fall through */ } }
    try { return JSON.parse(text); } catch { return null; }
  }
}
