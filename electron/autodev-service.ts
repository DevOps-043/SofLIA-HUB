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
import { createRequire } from 'node:module';
const requireModule = typeof require !== 'undefined' ? require : createRequire(import.meta.url);

let powerMonitor: any;
try {
  const electron = requireModule('electron');
  powerMonitor = electron.powerMonitor;
} catch {
  // We're running outside electron (e.g. from the CLI script)
}
import { GoogleGenerativeAI, SchemaType, FunctionDeclaration } from '@google/generative-ai';
import type { CronJob } from 'cron';

import {
  type AutoDevConfig,
  type AutoDevRun,
  type AutoDevImprovement,
  type ResearchFinding,
  type AutoDevRunStatus,
  type AgentRole,
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
} from './autodev-prompts';

// ─── Build error parsing ────────────────────────────────────────────

interface ParsedBuildError {
  file: string;
  line?: number;
  column?: number;
  code?: string;       // e.g. TS2345
  message: string;
}

function parseBuildErrors(buildOutput: string): ParsedBuildError[] {
  const errors: ParsedBuildError[] = [];
  const seen = new Set<string>();

  // Match TypeScript errors: src/file.ts(12,5): error TS2345: ...
  // Also matches: src/file.ts:12:5 - error TS2345: ...
  const patterns = [
    /([^\s(]+\.tsx?)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)/g,
    /([^\s(]+\.tsx?)[:.](\d+)[:.](\d+)\s*[-–]\s*error\s+(TS\d+):\s*(.+)/g,
    // Vite/esbuild style: ERROR in ./src/file.ts:12:5
    /ERROR.*?([^\s]+\.tsx?):(\d+):(\d+)/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(buildOutput)) !== null) {
      const key = `${match[1]}:${match[2]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      errors.push({
        file: match[1].replace(/\\/g, '/'),
        line: parseInt(match[2], 10),
        column: parseInt(match[3], 10) || undefined,
        code: match[4] || undefined,
        message: match[5]?.trim() || 'Unknown error',
      });
    }
  }

  return errors;
}

// ─── Constants ─────────────────────────────────────────────────────

const isElectron = typeof process !== 'undefined' && process.versions && !!process.versions.electron;
let userDataPath = '';
if (isElectron) {
  try {
    const electron = requireModule('electron');
    userDataPath = path.join(electron.app.getPath('userData'), '.autodev-data');
  } catch {
    userDataPath = path.join(process.cwd(), '.autodev-data');
  }
} else {
  const appData = process.platform === 'win32'
    ? process.env.APPDATA
    : process.env.HOME + (process.platform === 'darwin' ? '/Library/Application Support' : '/.config');
  userDataPath = path.join(appData || '', 'soflia-hub-desktop', '.autodev-data');
}

if (!fs.existsSync(userDataPath)) {
  try { fs.mkdirSync(userDataPath, { recursive: true }); } catch {}
}

const CONFIG_PATH = path.join(userDataPath, 'autodev-config.json');
const HISTORY_PATH = path.join(userDataPath, 'autodev-history.json');
const ERROR_MEMORY_PATH = path.join(userDataPath, 'autodev-error-memory.json');
const MAX_HISTORY_RUNS = 50;
const IGNORE_DIRS = ['node_modules', 'dist', 'dist-electron', '.git', 'build', 'coverage', 'SofLIA - Extension'];
const ISSUES_FILENAME = 'AUTODEV_ISSUES.md';

// ─── Error Memory (learns from past build failures) ─────────────────

interface ErrorMemoryEntry {
  pattern: string;       // e.g. "TS2345" or "Cannot find module"
  file: string;
  fix: string;           // What fixed it
  occurrences: number;
  lastSeen: string;
}

function loadErrorMemory(): ErrorMemoryEntry[] {
  try {
    if (fs.existsSync(ERROR_MEMORY_PATH)) {
      return JSON.parse(fs.readFileSync(ERROR_MEMORY_PATH, 'utf-8'));
    }
  } catch { /* empty */ }
  return [];
}

function saveErrorMemory(entries: ErrorMemoryEntry[]): void {
  try {
    if (!fs.existsSync(userDataPath)) { fs.mkdirSync(userDataPath, { recursive: true }); }
    // Keep max 200 entries, sorted by occurrences desc
    const trimmed = entries.sort((a, b) => b.occurrences - a.occurrences).slice(0, 200);
    fs.writeFileSync(ERROR_MEMORY_PATH, JSON.stringify(trimmed, null, 2), 'utf-8');
  } catch (err: any) {
    console.error('[AutoDev ErrorMemory] Save failed:', err.message);
  }
}

// ─── Tool declarations for function calling agents ─────────────────

const RESEARCH_TOOLS: FunctionDeclaration[] = [
  {
    name: 'web_search',
    description: 'Search the web for information about packages, vulnerabilities, best practices, documentation.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: { query: { type: SchemaType.STRING, description: 'Search query' } },
      required: ['query'],
    },
  },
  {
    name: 'read_webpage',
    description: 'Read and extract text content from a URL (documentation, changelogs, advisories).',
    parameters: {
      type: SchemaType.OBJECT,
      properties: { url: { type: SchemaType.STRING, description: 'URL to read' } },
      required: ['url'],
    },
  },
  {
    name: 'read_file',
    description: 'Read a file from the project for additional context.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: { path: { type: SchemaType.STRING, description: 'Relative path to the file' } },
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
      if (!fs.existsSync(userDataPath)) {
        try { fs.mkdirSync(userDataPath, { recursive: true }); } catch {}
      }
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
      if (!fs.existsSync(userDataPath)) {
        try { fs.mkdirSync(userDataPath, { recursive: true }); } catch {}
      }
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

  // ─── Self-Diagnosis: AUTODEV_ISSUES.md ─────────────────────────

  private get issuesPath(): string {
    return path.join(this.repoPath, ISSUES_FILENAME);
  }

  /** Read the current issues file, or return empty string if it doesn't exist */
  private readIssuesFile(): string {
    try {
      if (fs.existsSync(this.issuesPath)) {
        return fs.readFileSync(this.issuesPath, 'utf-8');
      }
    } catch { /* ignore */ }
    return '';
  }

  /** Append a new issue entry to the issues file */
  private logIssue(category: 'build_failure' | 'review_rejection' | 'runtime_error' | 'limitation' | 'coding_error' | 'dependency_issue', description: string, context?: string): void {
    const timestamp = new Date().toISOString();
    const runId = this.currentRun?.id || 'unknown';
    const existingContent = this.readIssuesFile();

    const header = existingContent
      ? ''
      : `# 🤖 AutoDev — Issues & Self-Diagnosis Log\n\n> Este archivo es generado y mantenido automáticamente por AutoDev.\n> Contiene errores, fallas y limitaciones detectadas durante las ejecuciones autónomas.\n> AutoDev usa este archivo como contexto para priorizar y resolver estos problemas en futuras ejecuciones.\n> **No borres este archivo** — AutoDev marcará como resueltos los issues que logre corregir.\n\n---\n\n`;

    const entry = [
      `## ❌ [${category.toUpperCase()}] — ${timestamp.split('T')[0]}`,
      '',
      `- **Run ID**: \`${runId}\``,
      `- **Timestamp**: ${timestamp}`,
      `- **Categoría**: ${category}`,
      `- **Estado**: 🔴 PENDIENTE`,
      '',
      '### Descripción',
      '',
      description,
      '',
      ...(context ? ['### Contexto técnico', '', '```', context.slice(0, 3000), '```', ''] : []),
      '---',
      '',
    ].join('\n');

    try {
      fs.writeFileSync(this.issuesPath, header + existingContent + entry, 'utf-8');
      console.log(`[AutoDev Self-Diagnosis] Logged issue: [${category}] ${description.slice(0, 80)}...`);
    } catch (err: any) {
      console.error('[AutoDev Self-Diagnosis] Failed to write issues file:', err.message);
    }
  }

  /** Mark all PENDIENTE issues as resolved after a successful run */
  private markIssuesResolved(runId: string): void {
    const resolvedNote = `- **Estado**: ✅ RESUELTO (por run \`${runId}\` — ${new Date().toISOString().split('T')[0]})`;
    const resolveFile = (filePath: string) => {
      try {
        if (!fs.existsSync(filePath)) return;
        let content = fs.readFileSync(filePath, 'utf-8');
        if (!content.includes('🔴 PENDIENTE')) return;
        content = content.replace(/- \*\*Estado\*\*: 🔴 PENDIENTE/g, resolvedNote);
        fs.writeFileSync(filePath, content, 'utf-8');
      } catch { /* best effort */ }
    };

    resolveFile(this.issuesPath);
    resolveFile(path.join(this.repoPath, 'AUTODEV_FEEDBACK.md'));
    console.log('[AutoDev Self-Diagnosis] Marked pending issues as resolved');
  }

  /** Generate a summary of open issues + user feedback for agent context */
  private getOpenIssuesSummary(): string {
    const parts: string[] = [];

    // Read self-diagnosed issues
    const issueContent = this.readIssuesFile();
    if (issueContent) {
      const sections = issueContent.split('## ❌');
      const pending = sections.filter(s => s.includes('🔴 PENDIENTE'));
      if (pending.length) {
        parts.push('\n═══ KNOWN ISSUES (from previous AutoDev runs) ═══');
        parts.push('The following issues were detected in previous runs and should be prioritized:');
        parts.push('');
        parts.push(...pending.slice(-30).map(s => '## ❌' + s.split('---')[0]));
      }
    }

    // Read user feedback/suggestions (from AUTODEV_FEEDBACK.md)
    const feedbackPath = path.join(this.repoPath, 'AUTODEV_FEEDBACK.md');
    try {
      if (fs.existsSync(feedbackPath)) {
        const feedbackContent = fs.readFileSync(feedbackPath, 'utf-8');
        const sections = feedbackContent.split('## ❌');
        const pending = sections.filter(s => s.includes('🔴 PENDIENTE'));
        if (pending.length) {
          parts.push('\n═══ USER FEEDBACK & SUGGESTIONS (from WhatsApp/Chat) ═══');
          parts.push('Users have reported these issues and suggestions. PRIORITIZE fixing these:');
          parts.push('');
          parts.push(...pending.slice(-20).map(s => '## ❌' + s.split('---')[0]));
        }
      }
    } catch { /* ignore */ }

    if (!parts.length) return '';

    parts.push('═══ END SELF-DIAGNOSIS CONTEXT ═══\n');
    return parts.join('\n');
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

    const isElectron = typeof process !== 'undefined' && process.versions && !!process.versions.electron;
    // Prevent the standalone sub-process from infinitely launching itself
    const isMainApp = isElectron && process.env.ELECTRON_RUN_AS_NODE !== '1';
    
    if (isMainApp) {
      this.emit('status-changed', { runId: 'spawned', status: 'spawned', agents: 0 });
      await this.runStandaloneTerminal();
      return { status: 'spawned_standalone' } as any;
    }

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
      if (run.status === 'failed') {
        this.logIssue('runtime_error', `Run falló con error: ${err.message}`, err.stack?.slice(0, 2000));
      }
      if (run.branchName) {
        await this.persistFailedBranch(run);
      }
    } finally {
      run.completedAt = new Date().toISOString();
      this.history.push(run);
      this.saveHistory();
      this.currentRun = null;
      this.abortController = null;
      this.emit('run-completed', run);

      if (this.config.notifyWhatsApp && this.config.notifyPhone) {
        let msg = run.status === 'completed' 
          ? `✅ AutoDev finalizó con éxito:\n\n${run.summary || 'Mejoras listas.'}\nPR: ${run.prUrl || 'N/A'}`
          : `❌ AutoDev abortado/falló:\n\n${run.error || 'Error desconocido'}`;
        this.queueWhatsApp(this.config.notifyPhone, msg);
      }
    }
    return run;
  }

  private queueWhatsApp(phone: string, message: string) {
    try {
      if (!fs.existsSync(userDataPath)) { fs.mkdirSync(userDataPath, { recursive: true }); }
      const qPath = path.join(userDataPath, 'whatsapp-queue.json');
      let queue: any[] = [];
      if (fs.existsSync(qPath)) {
        queue = JSON.parse(fs.readFileSync(qPath, 'utf8'));
      }
      queue.push({ phone, message });
      fs.writeFileSync(qPath, JSON.stringify(queue), 'utf8');
      this.emit('notify-whatsapp', { phone, message }); // Fallback for local
    } catch (err: any) {
       console.error('[AutoDev] WhatsApp queue error:', err.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  CORE MULTI-AGENT LOOP
  // ═══════════════════════════════════════════════════════════════════

  private async persistFailedBranch(run: AutoDevRun): Promise<void> {
    if (!run.branchName) return;
    try {
      console.log(`[AutoDev] Guardando cambios de intento fallido en repositorio remoto...`);
      const current = await this.git.getCurrentBranch();

      // If we're on a protected branch, try to switch to the work branch first
      if (current === this.config.targetBranch || current === 'master') {
        try {
          await this.git.switchBranch(run.branchName);
          console.log(`[AutoDev] Switched to work branch ${run.branchName} to persist failed changes`);
        } catch {
          // Work branch may not exist (e.g., createWorkBranch itself failed)
          console.warn(`[AutoDev] No se pudo cambiar al branch de trabajo ${run.branchName}. Descartando cambios.`);
          try { await this.git.switchBranch(this.config.targetBranch); } catch {}
          return;
        }
      }

      await this.git.stageAll();
      const lineCount = await this.git.getDiffLineCount();
      if (lineCount > 0) {
        await this.git.commitChanges(`[AutoDev] Fallo de Ejecución: ${run.error || 'Review needed'}`);
      }
      try { await this.git.pushBranch(run.branchName); } catch {}
      console.log(`\n[AutoDev] El código erróneo ha sido guardado en la rama remota y local: ${run.branchName}`);
      console.log(`[AutoDev] Puedes revisar los archivos localmente, intentar correr "npm run build" y ver qué falló!`);
      // Switch back to main so next run starts clean
      try { await this.git.switchBranch(this.config.targetBranch); } catch {}
    } catch (err: any) {
      console.warn(`[AutoDev] No se pudo persistir el branch: ${err.message}`);
      // Still try to go back to main
      try { await this.git.switchBranch(this.config.targetBranch); } catch {}
    }
  }

  private async executeRun(run: AutoDevRun): Promise<void> {
    const checkAbort = () => { if (this.abortController!.signal.aborted) throw new Error('Aborted'); };

    // ─── Validate ────────────────────────────────────────────────
    this.updateRunStatus(run, 'researching');
    if (!await this.git.hasRemote()) {
      this.logIssue('limitation', 'No hay un remote de Git configurado. AutoDev necesita un repositorio remoto para crear PRs.', 'git remote -v returned empty');
      throw new Error('No git remote configured');
    }
    if (!await this.git.isGhAuthenticated()) {
      this.logIssue('limitation', 'GitHub CLI no está autenticado. AutoDev necesita `gh auth login` para crear Pull Requests.', 'gh auth status failed');
      throw new Error('GitHub CLI not authenticated (run: gh auth login)');
    }
    checkAbort();

    // ─── Read known issues for context ────────────────────────────
    const knownIssues = this.getOpenIssuesSummary();
    if (knownIssues) {
      console.log('[AutoDev] Found open issues from previous runs — will include as context');
    }

    // ═══════════════════════════════════════════════════════════════
    //  PHASE 1: PARALLEL RESEARCH (up to 5 agents + npm simultaneously)
    // ═══════════════════════════════════════════════════════════════
    console.log('[AutoDev] ═══ Phase 1: Parallel Research ═══');

    const depsList = this.getDependenciesList();
    const sourceCode = await this.readProjectFiles();
    if (!sourceCode.length) throw new Error('No source files found');
    const sourceContext = sourceCode.map(f => `--- ${f.path} ---\n${f.content}`).join('\n\n') + knownIssues;

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
        name: 'FeaturesAgent',
        fn: () => this.runResearchAgent('features', depsList,
          'PRIORIDAD MÁXIMA: Investiga funcionalidades de OpenClaw, OpenHands y Cursor. Identifica herramientas y patrones innovadores para implementar en SofLIA.'),
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

    const phase1Results = await runParallel(filteredTasks as Array<{ name: string; fn: () => Promise<any> }>, this.config.maxParallelAgents,
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
      sourceContext,
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

    let improvements = await this.analyzeCode(sourceContext, run.researchFindings, npmAuditText, npmOutdatedText);

    // ─── Safety filter: block package.json major version bumps ────
    const beforeFilter = improvements.length;
    improvements = improvements.filter((imp: any) => {
      if (imp.file === 'package.json' && /major|upgrade|migrat/i.test(imp.description || '')) {
        console.log(`[AutoDev SafetyFilter] Blocked: "${imp.description}" — major version changes in package.json are prohibited`);
        return false;
      }
      return true;
    });
    if (beforeFilter !== improvements.length) {
      console.log(`[AutoDev SafetyFilter] Filtered ${beforeFilter - improvements.length} package.json major bump proposals`);
    }

    if (!improvements.length) {
      run.status = 'completed';
      run.summary = 'No actionable improvements found after research (some were filtered for safety).';
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

    const branchName = `autodev/${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}--${Math.random().toString(36).slice(2, 7)}`;
    run.branchName = await this.git.createWorkBranch(branchName, this.config.targetBranch);

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
                result.agentRole = 'coding';
                results.push(result);
              }
            } catch (err: any) {
              console.warn(`[AutoDev ${agentName}] Step failed (${step.file}): ${err.message}`);
              this.logIssue('coding_error', `El agente ${agentName} falló al implementar cambios en \`${step.file}\`: ${err.message}`, `File: ${step.file}\nStep: ${JSON.stringify(step, null, 2).slice(0, 1000)}`);
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
      this.logIssue('coding_error', 'Ninguna mejora se pudo aplicar exitosamente en este run. Todos los pasos de codificación fallaron.', `Improvements attempted: ${run.improvements.length}\nAgent tasks: ${run.agentTasks.map(t => `${t.description}: ${t.status}`).join(', ')}`);
      await this.persistFailedBranch(run);
      return;
    }

    // ═══════════════════════════════════════════════════════════════
    //  PHASE 4: PARALLEL REVIEW + BUILD (reviewer + tester agents) WITH AUTO-CORRECTION
    // ═══════════════════════════════════════════════════════════════
    let retries = 0;
    const maxRetries = 3;
    let buildResult: boolean | string = true;
    let reviewResult: { decision: string; summary: string } = { decision: 'approve', summary: '' };

    while (retries <= maxRetries) {
      console.log(`[AutoDev] ═══ Phase 4: Parallel Review + Build (Attempt ${retries + 1}/${maxRetries + 1}) ═══`);
      this.updateRunStatus(run, 'verifying');

      // Safety: ensure we're on the work branch before staging
      const currentBranch = await this.git.getCurrentBranch();
      if (currentBranch === this.config.targetBranch || currentBranch === 'master') {
        if (run.branchName) {
          console.warn(`[AutoDev] Safety: detected we are on ${currentBranch}, switching to work branch ${run.branchName}`);
          try { await this.git.switchBranch(run.branchName); } catch (switchErr: any) {
            run.status = 'failed';
            run.error = `Cannot switch to work branch ${run.branchName}: ${switchErr.message}`;
            return;
          }
        } else {
          run.status = 'failed';
          run.error = 'No work branch available and currently on protected branch';
          return;
        }
      }

      await this.git.stageAll();

      const lineCount = await this.git.getDiffLineCount();
      if (lineCount > this.config.maxLinesChanged) {
        run.status = 'failed';
        run.error = `Changes exceed line limit: ${lineCount} > ${this.config.maxLinesChanged}`;
        await this.persistFailedBranch(run);
        return;
      }

      const diff = await this.git.getFullDiff();

      // Run reviewer and tester in PARALLEL
      [reviewResult, buildResult] = await Promise.all([
        this.selfReview(diff, run.improvements, run.researchFindings),
        this.config.requireBuildPass ? this.verifyBuild() : Promise.resolve(true),
      ]);
      this.trackAgent(run, `ReviewerAgent_Attempt${retries+1}`, 'review', 'completed');
      this.trackAgent(run, `TesterAgent_Attempt${retries+1}`, 'testing', 'completed');

      if (buildResult === true && reviewResult.decision === 'approve') {
        break; // Success! Validated.
      }

      if (retries >= maxRetries) {
        if (buildResult !== true) {
          const buildErrorStr = typeof buildResult === 'string' ? buildResult : 'Unknown build error';
          const parsedErrors = parseBuildErrors(buildErrorStr);
          const errorSummary = parsedErrors.length
            ? parsedErrors.map(e => `[${e.code || 'ERR'}] ${e.file}:${e.line} — ${e.message}`).join('\n')
            : buildErrorStr.slice(0, 3000);
          run.status = 'failed';
          run.error = `Build failed after ${maxRetries + 1} attempts. ${parsedErrors.length} errors remain.`;
          this.logIssue('build_failure',
            `El build falló persistentemente después de ${maxRetries + 1} intentos de auto-corrección.\n\nErrores finales (${parsedErrors.length}):\n${errorSummary}`,
            `Archivos afectados: ${[...new Set(parsedErrors.map(e => e.file))].join(', ')}\nCódigos de error: ${[...new Set(parsedErrors.map(e => e.code).filter(Boolean))].join(', ')}`,
          );
        } else {
          run.status = 'failed';
          run.error = `Self-review rejected after ${maxRetries + 1} attempts: ${reviewResult.summary}`;
          this.logIssue('review_rejection', `El reviewer agent rechazó los cambios persistentemente: ${reviewResult.summary}`, `Diff size: ${diff.length}\nImprovements: ${run.improvements.length}`);
        }
        await this.persistFailedBranch(run);
        return;
      }

      retries++;
      // Log detailed failure info for this attempt
      if (buildResult !== true) {
        const buildErrorStr = typeof buildResult === 'string' ? buildResult : 'Unknown build error';
        const errorsThisAttempt = parseBuildErrors(buildErrorStr);
        console.log(`[AutoDev] ⚠️ BUILD FAILED — Attempt ${retries}/${maxRetries + 1}`);
        console.log(`[AutoDev]   Errors: ${errorsThisAttempt.length} | Files: ${[...new Set(errorsThisAttempt.map(e => e.file))].join(', ') || 'unknown'}`);
        for (const e of errorsThisAttempt.slice(0, 5)) {
          console.log(`[AutoDev]   → [${e.code || 'ERR'}] ${e.file}:${e.line} — ${e.message}`);
        }
      } else {
        console.log(`[AutoDev] ⚠️ REVIEW REJECTED — Attempt ${retries}/${maxRetries + 1}: ${reviewResult.summary.slice(0, 200)}`);
      }

      console.log(`[AutoDev] Attempting auto-correction...`);
      this.updateRunStatus(run, 'coding');

      // Mini Phase 3: Auto-Fix
      const errorStr = buildResult !== true ? `Build Error:\n${typeof buildResult === 'string' ? buildResult : 'Unknown'}` : `Review Error:\n${reviewResult.summary}`;
      const fixPlan = await this.createFixPlan(diff, errorStr);

      if (!fixPlan || !fixPlan.length) {
        console.warn(`[AutoDev FixAgent] No fix plan generated for attempt ${retries}. Will retry build anyway.`);
        continue;
      }

      console.log(`[AutoDev FixAgent] Generated fix plan with ${fixPlan.length} steps for attempt ${retries}`);
      this.trackAgent(run, `FixPlanner_${retries}`, 'coding', 'completed');

      let fixesApplied = 0;
      for (const step of fixPlan) {
        checkAbort();
        try {
          console.log(`[AutoDev FixAgent] Step: ${step.description?.slice(0, 80) || step.file} ...`);
          const result = await this.implementStep(step);
          if (result) {
            result.agentRole = 'coding';
            run.improvements.push(result);
            fixesApplied++;
            this.trackAgent(run, `FixAgent_${retries}`, 'coding', 'completed');
          }
        } catch (err: any) {
           console.warn(`[AutoDev FixAgent] Fix failed for ${step.file}: ${err.message}`);
           this.trackAgent(run, `FixAgent_${retries}`, 'coding', 'failed', err.message);
        }
      }
      console.log(`[AutoDev FixAgent] Applied ${fixesApplied}/${fixPlan.length} fixes. Re-running build...`);
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
    this.markIssuesResolved(run.id);

    try { await this.git.cleanupBranch(run.branchName!); } catch {}
    
    console.log(`[AutoDev] ═══ Run completed: ${run.improvements.filter(i => i.applied).length} improvements, PR: ${run.prUrl} ═══`);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  AGENT IMPLEMENTATIONS
  // ═══════════════════════════════════════════════════════════════════

  private trackAgent(run: AutoDevRun, name: string, role: string, status: 'completed' | 'failed', error?: string): void {
    const modelForRole = (r: string): string => {
      if (r === 'coding' || r === 'planning') return this.config.agents.coder.model;
      if (r === 'review') return this.config.agents.reviewer.model;
      if (r === 'testing') return this.config.agents.tester.model;
      if (r === 'security') return this.config.agents.security.model;
      if (r === 'dependencies') return this.config.agents.dependencies.model;
      return this.config.agents.researcher.model;
    };
    run.agentTasks.push({
      id: `${name}_${Date.now()}`,
      agentRole: role as AgentRole,
      model: modelForRole(role),
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

  private async runStandaloneTerminal(): Promise<{ status: string }> {
    if (process.platform === 'win32') {
      import('node:child_process').then(({ spawn }) => {
        spawn('cmd.exe', ['/c', 'start', 'cmd.exe', '/c', 'npm', 'run', 'autodev'], {
          detached: true,
          stdio: 'ignore',
          cwd: this.repoPath
        }).unref();
      });
    } else {
      import('node:child_process').then(({ spawn }) => {
        spawn('npm', ['run', 'autodev'], {
          detached: true,
          stdio: 'ignore',
          cwd: this.repoPath
        }).unref();
      });
    }
    return { status: 'spawned' };
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
          agentRole: 'research',
        }));
      }
    } catch (err: any) {
      console.warn(`[AutoDev ${category}Agent] Error:`, err.message);
    }
    return [];
  }

  // ─── Token Routing & Fallback ──────────────────────────────────
  private async getOptimalModel(intendedModel: string, promptText: string): Promise<string> {
    try {
      const ai = this.getGenAI();
      const model = ai.getGenerativeModel({ model: intendedModel });
      const { totalTokens } = await model.countTokens(promptText);
      
      if (totalTokens > 200000) {
        console.log(`\n[AutoDev Tokenizer] ⚠️ Prompt masivo detectado: ${totalTokens} tokens.`);
        console.log(`[AutoDev Tokenizer] 📉 Cambiando modelo '${intendedModel}' -> 'gemini-3-flash-preview' por límite de tarifa (200k) y economía.`);
        return 'gemini-3-flash-preview';
      }
      return intendedModel;
    } catch (err: any) {
      // Heurística de emergencia si falla la API de countTokens
      const estimatedTokens = Math.ceil(promptText.length / 4);
      if (estimatedTokens > 200000) {
        console.log(`\n[AutoDev Tokenizer] ⚠️ Prompt masivo detectado por heurística: ~${estimatedTokens} tokens.`);
        console.log(`[AutoDev Tokenizer] 📉 Cambiando modelo '${intendedModel}' -> 'gemini-3-flash-preview' preventivamente.`);
        return 'gemini-3-flash-preview';
      }
      return intendedModel;
    }
  }

  // ─── Agentic Deep Research (coding model + function calling) ───

  private async runAgenticResearch(
    codeContext: string,
    npmAuditText: string,
    npmOutdatedText: string,
    priorFindings: ResearchFinding[],
  ): Promise<ResearchFinding[]> {
    const findings: ResearchFinding[] = [];
    const priorContext = priorFindings.filter(f => f.actionable)
      .map(f => `- [${f.category}] ${f.findings}\n  Sources: ${f.sources.join(', ')}`).join('\n');
    const prompt = `Eres un investigador de software. Usa web_search y read_webpage para profundizar en las mejoras detectadas.

## Investigación previa (de agentes paralelos)
${priorContext || 'Ninguna'}

## npm audit
${npmAuditText}

## npm outdated
${npmOutdatedText}

## Código
${codeContext}

## Categorías: ${this.config.categories.join(', ')}

## Instrucciones
1. Para cada hallazgo previo, busca más detalles: changelogs, fixes, migration guides
2. Verifica que las soluciones propuestas son correctas leyendo documentación oficial
3. Máximo ${this.config.maxResearchQueries} búsquedas web en total

Responde con JSON: { "findings": [{ "query": "...", "category": "...", "findings": "...", "sources": ["..."], "actionable": true/false }] }`;

    const execute = async (baseModel: string): Promise<ResearchFinding[]> => {
      const finalModel = await this.getOptimalModel(baseModel, prompt);
      const resultsAccum: ResearchFinding[] = [];
      const ai = this.getGenAI();
      const model = ai.getGenerativeModel({
        model: finalModel,
        tools: [{ functionDeclarations: RESEARCH_TOOLS }],
      });

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
        
        console.log(`[AutoDev Tokenizer] ⏳ Refrescando quota de Tokens (esperando 15s) antes del siguiente ciclo de análisis profundo...`);
        await new Promise(r => setTimeout(r, 15000));

        response = await chat.sendMessage(results);
      }

      const parsed = this.parseJSON(response.response.text());
      if (parsed?.findings) {
        for (const f of parsed.findings) {
          resultsAccum.push({
            query: f.query || '', category: f.category || 'quality',
            findings: f.findings || '', sources: f.sources || [],
            actionable: f.actionable ?? false, agentRole: 'research',
          });
        }
      }
      return resultsAccum;
    };

    try {
      return await execute(this.config.agents.coder.model);
    } catch (err: any) {
      if (err.message && (err.message.includes('429') || err.message.includes('503'))) {
        console.warn(`\n[AutoDev DeepResearcher] ⚠️ Límite de cuota superado en el modelo pesado (${this.config.agents.coder.model}).`);
        console.warn(`[AutoDev Tokenizer] ⏳ Enfriando API por 45 segundos para limpiar quota penalizada, y luego usaremos el modelo Flash...`);
        await new Promise(r => setTimeout(r, 45000));
        try {
          return await execute('gemini-3-flash-preview');
        } catch (fallbackErr: any) {
          console.warn('[AutoDev DeepResearcher] Fallback Error:', fallbackErr.message);
        }
      } else {
        console.warn(`[AutoDev DeepResearcher] Error:`, err.message);
      }
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
        console.log(`[AutoDev DeepResearcher] 🔍 Realizando búsqueda en internet: "${args.query}"`);
        const r = await webSearch(args.query);
        return { success: r.success, result: r.results, error: r.error };
      }
      case 'read_webpage': {
        console.log(`[AutoDev DeepResearcher] 📖 Leyendo página web: ${args.url}`);
        const r = await readWebpage(args.url);
        return { success: r.success, result: r.content, error: r.error };
      }
      case 'read_file': {
        try {
          const fp = path.resolve(this.repoPath, args.path);
          if (!fp.startsWith(this.repoPath)) return { success: false, error: 'Path outside repository' };
          return { success: true, result: fs.readFileSync(fp, 'utf-8') };
        } catch (err: any) {
          return { success: false, error: err.message };
        }
      }
      default: return { success: false, error: `Unknown tool: ${name}` };
    }
  }

  // ─── Analysis (coding model) ──────────────────────────────────

  private getErrorMemoryContext(): string {
    const errorMemory = loadErrorMemory();
    if (!errorMemory.length) return 'No hay errores registrados de runs anteriores.';
    const top = errorMemory.slice(0, 15);
    return top.map(m => `- [${m.pattern}] en ${m.file}: ${m.fix} (ocurrencias: ${m.occurrences}, último: ${m.lastSeen})`).join('\n');
  }

  private getRunHistorySummary(): string {
    if (!this.history.length) return 'No hay historial de runs anteriores.';
    const recent = this.history.slice(-5);
    return recent.map(r => {
      const applied = r.improvements.filter(i => i.applied).length;
      return `- Run ${r.id} (${r.startedAt.slice(0, 10)}): ${r.status} — ${applied} mejoras aplicadas${r.error ? ` — Error: ${r.error.slice(0, 100)}` : ''}`;
    }).join('\n');
  }

  private async analyzeCode(sourceContext: string, findings: ResearchFinding[], npmAuditText: string, npmOutdatedText: string): Promise<any[]> {
    const findingsText = findings.filter(f => f.actionable)
      .map(f => `- [${f.category}] ${f.findings}\n  Sources: ${f.sources.join(', ')}`).join('\n');

    const prompt = ANALYZE_PROMPT
      .replace('{REPO_PATH}', this.repoPath)
      .replace('{RESEARCH_FINDINGS}', findingsText || 'No prior findings')
      .replace('{NPM_AUDIT}', npmAuditText)
      .replace('{NPM_OUTDATED}', npmOutdatedText)
      .replace('{SOURCE_CODE}', sourceContext)
      .replace('{CATEGORIES}', this.config.categories.join(', '))
      .replace('{MAX_FILES}', String(this.config.maxFilesPerRun))
      .replace('{MAX_LINES}', String(this.config.maxLinesChanged))
      .replace('{ERROR_MEMORY}', this.getErrorMemoryContext())
      .replace('{RUN_HISTORY}', this.getRunHistorySummary());

    const execute = async (baseModel: string): Promise<any[]> => {
      const finalModel = await this.getOptimalModel(baseModel, prompt);
      const ai = this.getGenAI();
      const model = ai.getGenerativeModel({
        model: finalModel,
        tools: [{ functionDeclarations: RESEARCH_TOOLS }],
      });

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
        
        console.log(`[AutoDev Tokenizer] ⏳ Refrescando quota de Tokens (esperando 15s) en análisis de código...`);
        await new Promise(r => setTimeout(r, 15000));

        response = await chat.sendMessage(results);
      }

      return this.parseJSON(response.response.text())?.improvements || [];
    };

    try {
      return await execute(this.config.agents.coder.model);
    } catch (err: any) {
      if (err.message && err.message.includes('429')) {
        console.warn(`\n[AutoDev Analyzer] ⚠️ Cuota excedida en ${this.config.agents.coder.model}.`);
        console.warn(`[AutoDev Tokenizer] ⏳ Enfriando API por 45 segundos para limpiar quota, intercambiando al modelo Flash...`);
        await new Promise(r => setTimeout(r, 45000));
        try {
          return await execute('gemini-3-flash-preview');
        } catch (e: any) {
          throw e; // Si ya falla el flash, lanzar error original
        }
      }
      throw err;
    }
  }

  // ─── Planning (coding model) ──────────────────────────────────

  private async generatePlan(improvements: any[], findings: ResearchFinding[]): Promise<any[]> {
    const ai = this.getGenAI();
    const model = ai.getGenerativeModel({ model: this.config.agents.coder.model });
    const ctx = findings.filter(f => f.actionable).map(f => `- [${f.category}] ${f.findings} (${f.sources.join(', ')})`).join('\n');

    const prompt = PLAN_PROMPT
      .replace('{IMPROVEMENTS}', JSON.stringify(improvements, null, 2))
      .replace('{RESEARCH_CONTEXT}', ctx || 'None')
      .replace('{MAX_LINES}', String(this.config.maxLinesChanged))
      .replace('{ERROR_MEMORY}', this.getErrorMemoryContext());

    const result = await model.generateContent(prompt);
    const plan = this.parseJSON(result.response.text())?.plan || [];

    // ─── Pre-flight validation: filter out dangerous plan steps ───
    return plan.filter((step: any) => {
      // Block npm install commands with @latest
      if (step.action === 'command' && step.command) {
        const cmd = step.command;
        if (cmd.includes('@latest') && (cmd.includes('electron') || cmd.includes('react') || cmd.includes('typescript') || cmd.includes('sharp') || cmd.includes('vite'))) {
          console.log(`[AutoDev SafetyFilter] Blocked command: "${cmd}" — core packages cannot be updated via @latest`);
          return false;
        }
      }
      return true;
    });
  }

  // ─── Code implementation (coding model + tools) ───────────────

  private async createFixPlan(diff: string, errorMsg: string): Promise<any[]> {
    // ─── Parse build errors to extract specific file:line info ────
    const parsedErrors = parseBuildErrors(errorMsg);
    const affectedFiles = [...new Set(parsedErrors.map(e => e.file))];

    // ─── Read the actual source of broken files ──────────────────
    const fileContents: string[] = [];
    for (const file of affectedFiles.slice(0, 8)) {
      try {
        const fullPath = path.resolve(this.repoPath, file);
        if (fullPath.startsWith(this.repoPath) && fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          fileContents.push(`--- ${file} ---\n${content.slice(0, 15000)}`);
        }
      } catch { /* skip */ }
    }

    // ─── Load past error patterns (learning from history) ────────
    const errorMemory = loadErrorMemory();
    const relevantMemory = errorMemory
      .filter(m => parsedErrors.some(e => e.code === m.pattern || e.message.includes(m.pattern)))
      .slice(0, 10);
    const memoryContext = relevantMemory.length
      ? `\n## ERRORES PASADOS (memoria de correcciones anteriores)\nEstos errores han ocurrido antes. Usa lo que funcionó:\n${relevantMemory.map(m => `- ${m.pattern} en ${m.file}: FIX → ${m.fix} (ocurrencias: ${m.occurrences})`).join('\n')}`
      : '';

    // ─── Structured error summary ────────────────────────────────
    const structuredErrors = parsedErrors.length
      ? `## ERRORES DETECTADOS (${parsedErrors.length} errores parseados)\n${parsedErrors.map((e, i) => `${i + 1}. [${e.code || 'ERROR'}] ${e.file}:${e.line || '?'} — ${e.message}`).join('\n')}`
      : `## ERROR RAW (no se pudieron parsear errores específicos)\n${errorMsg.slice(0, 5000)}`;

    const prompt = `Eres un agente de auto-corrección (FixAgent). Tu implementación anterior generó errores de compilación que DEBES corregir.

${structuredErrors}
${memoryContext}

## CÓDIGO FUENTE DE LOS ARCHIVOS AFECTADOS
${fileContents.join('\n\n') || '(No se pudieron leer los archivos afectados)'}

## DIFF DE CAMBIOS QUE CAUSARON EL ERROR
\`\`\`diff
${diff.slice(0, 50000)}
\`\`\`

## INSTRUCCIONES CRÍTICAS
1. Analiza CADA error específicamente. No adivines — lee el código fuente y el error.
2. Si un tipo no existe (TS2304), elimina la referencia o importa el tipo correcto.
3. Si hay argumento incorrecto (TS2345), verifica la firma de la función en el código fuente.
4. Si hay propiedad inexistente (TS2339), busca el nombre correcto en la interfaz.
5. Si creaste imports que no existen, ELIMÍNALOS.
6. Si necesitas REVERTIR un cambio que rompió algo, hazlo — es mejor revertir que dejar el build roto.
7. NUNCA dejes código a medias. Cada archivo debe compilar correctamente.
8. Si un tipo genérico no se infiere (TS2345 con ZodObject), usa \`as any\` o especifica el tipo explícitamente.
9. Para Supabase: NUNCA uses .catch() — usa destructuring \`const { data, error } = await ...\`
10. Si importaste un tipo/variable sin usarlo (TS6133), QUITA el import.
11. PREFIERE revertir el cambio problemático a intentar un fix complejo que puede generar más errores.

## FORMATO JSON REQUERIDO (Solo devuelve JSON):
{
  "plan": [
    {
      "step": 1,
      "file": "ruta/archivo.ts",
      "action": "modify",
      "description": "Explicación precisa del fix",
      "details": "Qué línea(s) cambiar y por qué — referencia el error específico",
      "source": "Auto-Correction System",
      "category": "quality",
      "estimatedLines": 5
    }
  ],
  "errorAnalysis": "Resumen de por qué fallaron los cambios originales"
}`;

    const execute = async (baseModel: string): Promise<any[]> => {
      const finalModel = await this.getOptimalModel(baseModel, prompt);
      const ai = this.getGenAI();
      const model = ai.getGenerativeModel({ model: finalModel });
      const res = await model.generateContent(prompt);
      const parsed = this.parseJSON(res.response.text());

      // Log the error analysis for learning
      if (parsed?.errorAnalysis) {
        console.log(`[AutoDev FixAgent] Error Analysis: ${parsed.errorAnalysis}`);
      }

      return parsed?.plan || [];
    };

    try {
      const plan = await execute(this.config.agents.coder.model);

      // ─── Record errors to memory for future learning ───────────
      for (const err of parsedErrors) {
        const pattern = err.code || err.message.slice(0, 60);
        const existing = errorMemory.find(m => m.pattern === pattern && m.file === err.file);
        if (existing) {
          existing.occurrences++;
          existing.lastSeen = new Date().toISOString();
        } else {
          errorMemory.push({
            pattern,
            file: err.file,
            fix: plan.find(p => p.file === err.file)?.description || 'pending',
            occurrences: 1,
            lastSeen: new Date().toISOString(),
          });
        }
      }
      saveErrorMemory(errorMemory);

      return plan;
    } catch (err: any) {
      if (err.message && err.message.includes('429')) {
        console.warn(`\n[AutoDev FixAgent] ⚠️ Cuota excedida en modelo pesado. Enfriando 45s e intercambiando a Flash...`);
        await new Promise(r => setTimeout(r, 45000));
        try {
          return await execute('gemini-3-flash-preview');
        } catch { return []; }
      }
      return [];
    }
  }

  private async implementStep(step: any): Promise<AutoDevImprovement | null> {
    if (step.action === 'command' && step.command) {
      let currentCommand = step.command;

      // Pre-validate npm install commands: verify packages and versions exist before running
      if (currentCommand.includes('npm install') || currentCommand.includes('npm i ')) {
        const { verifyNpmPackage } = await import('./autodev-sandbox');
        const parts = currentCommand.split(/\s+/);
        const npmIdx = parts.findIndex((p: string) => p === 'install' || p === 'i');
        const packages = parts.slice(npmIdx + 1).filter((p: string) => !p.startsWith('-'));
        const validPackages: string[] = [];

        // Block packages that should never be updated automatically
        const BLOCKED_PACKAGES = ['electron', 'react', 'react-dom', 'vite', 'typescript', 'sharp', '@electron/rebuild'];

        for (const pkg of packages) {
          const pkgName = pkg.startsWith('@') ? '@' + pkg.slice(1).split('@')[0] : pkg.split('@')[0];
          if (BLOCKED_PACKAGES.includes(pkgName)) {
            console.warn(`[AutoDev CoderAgent] Paquete bloqueado (core/nativo): ${pkg}`);
            continue;
          }
          try {
            await verifyNpmPackage(pkg);
            validPackages.push(pkg);
          } catch (err: any) {
            console.warn(`[AutoDev CoderAgent] Paquete inválido eliminado: ${pkg} — ${err.message}`);
          }
        }

        if (validPackages.length === 0) {
          console.warn(`[AutoDev CoderAgent] Todos los paquetes fueron inválidos. Saltando comando.`);
          return null;
        }

        // Rebuild command with only valid packages
        const flags = parts.slice(npmIdx + 1).filter((p: string) => p.startsWith('-'));
        currentCommand = `npm install ${validPackages.join(' ')} ${flags.join(' ')}`.trim();
        console.log(`[AutoDev CoderAgent] Comando validado: ${currentCommand}`);
      }

      const maxRetries = 2;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        console.log(`[AutoDev CoderAgent] Ejecutando comando de terminal (Intento ${attempt + 1}/${maxRetries + 1}): ${currentCommand}`);
        try {
          const { promisify } = await import('node:util');
          const { exec } = await import('node:child_process');
          const { stdout } = await promisify(exec)(currentCommand, { cwd: this.repoPath });
          console.log(`[AutoDev CoderAgent] Comando finalizado exitosamente. ${stdout.slice(0, 100).replace(/\n/g, ' ')}...`);
          return {
            file: 'Terminal',
            category: step.category || 'dependencies',
            description: `Ejecutó comando: ${currentCommand}`,
            applied: true,
            researchSources: [step.source].filter(Boolean),
            agentRole: 'coding',
          };
        } catch (err: any) {
          console.warn(`[AutoDev CoderAgent] Error al ejecutar comando: ${err.message}`);
          if (attempt >= maxRetries) {
            console.error(`[AutoDev CoderAgent] Comando falló después de ${maxRetries + 1} intentos.`);
            throw new Error(`Command failed after retries: ${err.message}`);
          }
          console.log(`[AutoDev CoderAgent] 🤖 Consultando a la IA para auto-corregir el comando al instante...`);
          const fixPrompt = `El siguiente comando de terminal falló:\nComando actual: ${currentCommand}\n\nError:\n${err.message.slice(0, 2000)}\n\nEres un sistema de auto-corrección. Analiza el error y devuelve el COMANDO CORREGIDO.\nReglas de corrección rigurosas:\n1. Si hubo un error EBUSY en un paquete (ej. electron o sqlite3), QUITA ese paquete del string y deja los demás.\n2. Si hubo ERESOLVE o conflictos de dependencias peer, ASEGÚRATE de añadir " --legacy-peer-deps".\n3. Si hubo 404 (Not Found), SIGNIFICA QUE EL PAQUETE ES INVENTADO O NO ENCONTRADO, ELIMINA ESE PAQUETE EXACTO.\n4. Si el comando está viciado y ya no tiene sentido instalar paquetes, devuelve un string vacío "".\n\nDevuelve ÚNICAMENTE un JSON con: { "command": "nuevo comando corregido" }`;
          try {
            const ai = this.getGenAI();
            const model = ai.getGenerativeModel({ model: 'gemini-3-flash-preview', generationConfig: { responseMimeType: 'application/json' } });
            const res = await model.generateContent(fixPrompt);
            const parsed = this.parseJSON(res.response.text());
            if (parsed && typeof parsed.command === 'string') {
              if (parsed.command.trim() === '') throw new Error('AI aborted command fix');
              currentCommand = parsed.command;
              console.log(`[AutoDev CoderAgent] ✅ Comando auto-corregido: ${currentCommand}`);
            } else {
              throw new Error('Invalid fix format');
            }
          } catch (fixErr: any) {
            console.warn(`[AutoDev CoderAgent] Falla en auto-corrección: ${fixErr.message}`);
            throw new Error(`Command failed and auto-fix failed: ${err.message}`);
          }
        }
      }
    }

    const filePath = path.resolve(this.repoPath, step.file);
    if (!filePath.startsWith(this.repoPath)) return null;

    let currentCode = '';
    try { currentCode = fs.readFileSync(filePath, 'utf-8'); } catch {
      if (step.action !== 'create') return null;
    }

    const prompt = CODE_PROMPT
      .replace('{PLAN_STEP}', JSON.stringify(step, null, 2))
      .replace('{FILE_PATH}', step.file)
      .replace('{CURRENT_CODE}', currentCode)
      .replace('{RESEARCH_CONTEXT}', step.source || 'None')
      .replace('{LESSONS_LEARNED}', this.getErrorMemoryContext());

    const execute = async (baseModel: string): Promise<any> => {
      const finalModel = await this.getOptimalModel(baseModel, prompt);
      const ai = this.getGenAI();
      const model = ai.getGenerativeModel({
        model: finalModel,
        tools: [{ functionDeclarations: RESEARCH_TOOLS }],
      });

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
        console.log(`[AutoDev Tokenizer] ⏳ Refrescando quota de Tokens (esperando 15s) en codificación de paso...`);
        await new Promise(r => setTimeout(r, 15000));
        response = await chat.sendMessage(results);
      }

      return this.parseJSON(response.response.text());
    };

    let parsed: any = null;
    try {
      parsed = await execute(this.config.agents.coder.model);
    } catch (err: any) {
      if (err.message && (err.message.includes('429') || err.message.includes('fetch failed'))) {
        console.warn(`\n[AutoDev CoderAgent] ⚠️ Falla de Red/Cuota en ${step.file}. Enfriando 45s y tratando con Flash...`);
        await new Promise(r => setTimeout(r, 45000));
        try {
          parsed = await execute('gemini-3-flash-preview');
        } catch (e: any) {
          console.warn(`[AutoDev CoderAgent] Step completely failed (fallback):`, e.message);
          return null;
        }
      } else {
        console.warn(`[AutoDev CoderAgent] Step completely failed:`, err.message);
        return null;
      }
    }
    if (!parsed?.modifiedCode) return null;

    // ─── Safety: block major version bumps in package.json ────────
    if (step.file === 'package.json' || filePath.endsWith('package.json')) {
      if (this.hasMajorVersionBump(currentCode, parsed.modifiedCode)) {
        console.warn(`[AutoDev SafetyGuard] ⛔ BLOCKED: package.json write contains major version bump. Skipping.`);
        return null;
      }
    }

    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, parsed.modifiedCode, 'utf-8');

    return {
      file: step.file, category: step.category || 'quality',
      description: parsed.changesDescription || step.description || '',
      applied: true, researchSources: parsed.sourcesConsulted || [step.source].filter(Boolean),
      agentRole: 'coding',
    };
  }

  // ─── Build verification (tester agent) ────────────────────────

  private async verifyBuild(): Promise<boolean | string> {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    try {
      await promisify(execFile)('npm', ['run', 'build'], {
        cwd: this.repoPath, timeout: 180_000, maxBuffer: 10 * 1024 * 1024, shell: true,
      });
      console.log('[AutoDev TesterAgent] Build passed.');

      // ─── On success: update error memory with successful fixes ──
      const errorMemory = loadErrorMemory();
      const pendingFixes = errorMemory.filter(m => m.fix === 'pending');
      if (pendingFixes.length) {
        for (const entry of pendingFixes) {
          entry.fix = 'Resolved — build passed after auto-correction';
        }
        saveErrorMemory(errorMemory);
        console.log(`[AutoDev TesterAgent] Updated ${pendingFixes.length} error memory entries as resolved.`);
      }

      return true;
    } catch (err: any) {
      const rawOutput = [err.stdout, err.stderr, err.message].filter(Boolean).join('\n---\n');
      const parsedErrors = parseBuildErrors(rawOutput);

      if (parsedErrors.length) {
        console.error(`[AutoDev TesterAgent] Build failed with ${parsedErrors.length} errors:`);
        for (const e of parsedErrors.slice(0, 10)) {
          console.error(`  [${e.code || 'ERR'}] ${e.file}:${e.line} — ${e.message}`);
        }
      } else {
        console.error('[AutoDev TesterAgent] Build failed (no parseable TS errors).');
      }

      return rawOutput || 'Unknown build error';
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
    // Budget: ~300K chars ≈ ~75K tokens. Allows reading most project files while staying within Gemini context limits.
    const MAX_TOTAL_CHARS = 300_000;
    const MAX_FILE_CHARS = 25_000; // Truncate individual files beyond this
    const allFiles: Array<{ path: string; size: number; priority: number }> = [];
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
          const stat = fs.statSync(fullPath);
          if (stat.size > 500_000) continue;
          const normalizedPath = relPath.replace(/\\/g, '/');
          // Priority: 0 = highest (electron core), 1 = src, 2 = other
          const priority = normalizedPath.startsWith('electron/') ? 0
            : normalizedPath.startsWith('src/') ? 1 : 2;
          allFiles.push({ path: normalizedPath, size: stat.size, priority });
        } catch { /* skip */ }
      }
    };
    walk(this.repoPath);

    // Sort: priority ASC, then size ASC (smaller files first within same priority)
    allFiles.sort((a, b) => a.priority - b.priority || a.size - b.size);

    const files: Array<{ path: string; content: string }> = [];
    let totalChars = 0;

    for (const f of allFiles) {
      if (totalChars >= MAX_TOTAL_CHARS) break;
      try {
        const fullPath = path.join(this.repoPath, f.path);
        let content = fs.readFileSync(fullPath, 'utf-8');
        if (content.length > MAX_FILE_CHARS) {
          content = content.slice(0, MAX_FILE_CHARS) + '\n// ... [truncated by AutoDev — file too large]';
        }
        const remaining = MAX_TOTAL_CHARS - totalChars;
        if (content.length > remaining) {
          content = content.slice(0, remaining) + '\n// ... [truncated by AutoDev — budget limit]';
        }
        files.push({ path: f.path, content });
        totalChars += content.length;
      } catch { /* skip */ }
    }

    console.log(`[AutoDev] readProjectFiles: ${files.length}/${allFiles.length} files, ${Math.round(totalChars / 1000)}K chars (budget: ${MAX_TOTAL_CHARS / 1000}K)`);
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

  /**
   * Detect if a package.json modification contains major version bumps.
   * Compares old vs new dependency versions — blocks if any major changed.
   */
  private hasMajorVersionBump(oldContent: string, newContent: string): boolean {
    try {
      const oldPkg = JSON.parse(oldContent);
      const newPkg = JSON.parse(newContent);
      const PROTECTED_PACKAGES = [
        'react', 'react-dom', 'vite', 'electron', 'typescript',
        '@electron/rebuild', '@electron-toolkit/preload', '@electron-toolkit/utils',
        'electron-builder', 'electron-vite',
      ];

      for (const section of ['dependencies', 'devDependencies'] as const) {
        const oldDeps = oldPkg[section] || {};
        const newDeps = newPkg[section] || {};
        for (const pkg of Object.keys(newDeps)) {
          if (!oldDeps[pkg]) continue; // new package addition is fine
          const oldMajor = (oldDeps[pkg] as string).replace(/[\^~>=<\s]/g, '').split('.')[0];
          const newMajor = (newDeps[pkg] as string).replace(/[\^~>=<\s]/g, '').split('.')[0];
          if (oldMajor !== newMajor) {
            console.warn(`[AutoDev SafetyGuard] Major bump detected: ${pkg} ${oldDeps[pkg]} → ${newDeps[pkg]} (major: ${oldMajor} → ${newMajor})`);
            if (PROTECTED_PACKAGES.includes(pkg) || parseInt(newMajor) > parseInt(oldMajor)) {
              return true;
            }
          }
        }
      }
    } catch {
      // If we can't parse either JSON, block the write as a safety measure
      console.warn('[AutoDev SafetyGuard] Could not parse package.json for version comparison — blocking write');
      return true;
    }
    return false;
  }

  private parseJSON(text: string): any {
    const m = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
    if (m) { try { return JSON.parse(m[1]); } catch { /* fall through */ } }
    try { return JSON.parse(text); } catch { return null; }
  }
}
