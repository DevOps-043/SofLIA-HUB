/**
 * AutoDev Types — Interfaces for the autonomous self-programming system.
 * Multi-agent architecture with parallel execution.
 */

// ─── Agent Configuration ────────────────────────────────────────────

export interface AgentConfig {
  model: string;
  role: 'research' | 'coding' | 'review' | 'security' | 'dependencies' | 'testing';
  description: string;
  concurrency: number; // How many parallel instances
}

// ─── MCP Configuration ──────────────────────────────────────────────

export interface McpServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface AutoDevConfig {
  enabled: boolean;
  cronSchedule: string;

  // ─── Multi-agent models ───────────────────────────────────────
  agents: {
    researcher: AgentConfig;    // Web research + googleSearch grounding
    coder: AgentConfig;         // Code analysis + implementation
    reviewer: AgentConfig;      // Self-review + quality check
    security: AgentConfig;      // Security-focused analysis
    dependencies: AgentConfig;  // Dependency audit + updates
    tester: AgentConfig;        // Test generation + verification
  };

  // ─── Limits ───────────────────────────────────────────────────
  maxFilesPerRun: number;
  maxDailyRuns: number;
  maxLinesChanged: number;
  maxResearchQueries: number;
  maxParallelAgents: 1 | 2;    // Total concurrent agents across all types

  // ─── API & Integrations ───────────────────────────────────────
  rateLimitRetryBackoff?: boolean;
  mcpServers?: McpServerConfig[];

  // ─── Git/PR ───────────────────────────────────────────────────
  targetBranch: string;
  workBranchPrefix: string;
  autoMerge: boolean;
  requireBuildPass: boolean;

  // ─── Scope ────────────────────────────────────────────────────
  categories: AutoDevCategory[];

  // ─── Notifications ────────────────────────────────────────────
  notifyWhatsApp: boolean;
  notifyPhone: string;
}

export type AutoDevCategory =
  | 'security'
  | 'quality'
  | 'performance'
  | 'dependencies'
  | 'tests';

export type AutoDevRunStatus =
  | 'researching'
  | 'analyzing'
  | 'planning'
  | 'coding'
  | 'verifying'
  | 'pushing'
  | 'completed'
  | 'failed'
  | 'aborted';

// ─── Agent Task Tracking ────────────────────────────────────────────

export interface AgentTask {
  id: string;
  agentRole: string;
  model: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
  description: string;
  result?: any;
  error?: string;
}

// ─── Run ────────────────────────────────────────────────────────────

export interface AutoDevRun {
  id: string;
  startedAt: string;
  completedAt?: string;
  status: AutoDevRunStatus;
  improvements: AutoDevImprovement[];
  researchFindings: ResearchFinding[];
  agentTasks: AgentTask[];     // Track all agent work
  branchName?: string;
  prUrl?: string;
  summary: string;
  error?: string;
}

export interface AutoDevImprovement {
  file: string;
  category: AutoDevCategory;
  description: string;
  diff?: string;
  applied: boolean;
  researchSources: string[];
  agentRole: string;          // Which agent produced this
}

export interface ResearchFinding {
  query: string;
  category: AutoDevCategory;
  findings: string;
  sources: string[];
  actionable: boolean;
  agentRole: string;          // Which agent found this
}

// ─── NPM Types ──────────────────────────────────────────────────────

export interface NpmAuditVulnerability {
  name: string;
  severity: 'critical' | 'high' | 'moderate' | 'low' | 'info';
  title: string;
  url: string;
  range: string;
  fixAvailable: boolean;
}

export interface NpmOutdatedPackage {
  name: string;
  current: string;
  wanted: string;
  latest: string;
  type: 'dependencies' | 'devDependencies';
}

// ─── Defaults ───────────────────────────────────────────────────────

export const DEFAULT_AGENTS: AutoDevConfig['agents'] = {
  researcher: {
    model: 'gemini-3-flash-preview',
    role: 'research',
    description: 'Investigador web — busca CVEs, changelogs, best practices con Google Search grounding',
    concurrency: 3,  // 3 researchers in parallel (security, deps, quality)
  },
  coder: {
    model: 'gemini-3.1-pro-preview-customtools',
    role: 'coding',
    description: 'Programador — analiza código, planifica e implementa mejoras con herramientas custom',
    concurrency: 2,  // 2 coders working on different files
  },
  reviewer: {
    model: 'gemini-3-flash-preview',
    role: 'review',
    description: 'Revisor — verifica diffs, valida calidad, aprueba/rechaza cambios',
    concurrency: 1,
  },
  security: {
    model: 'gemini-3-flash-preview',
    role: 'security',
    description: 'Auditor de seguridad — busca vulnerabilidades, XSS, injection, OWASP top 10',
    concurrency: 1,
  },
  dependencies: {
    model: 'gemini-3-flash-preview',
    role: 'dependencies',
    description: 'Auditor de dependencias — analiza npm audit, outdated, breaking changes',
    concurrency: 1,
  },
  tester: {
    model: 'gemini-3-flash-preview',
    role: 'testing',
    description: 'Tester — verifica que build pasa, genera tests sugeridos, valida cobertura',
    concurrency: 1,
  },
};

export const DEFAULT_CONFIG: AutoDevConfig = {
  enabled: false,
  cronSchedule: '0 3 * * *',
  agents: { ...DEFAULT_AGENTS },
  maxFilesPerRun: 15,
  maxDailyRuns: 3,
  maxLinesChanged: 500,
  maxResearchQueries: 30,
  maxParallelAgents: 2,
  rateLimitRetryBackoff: true,
  targetBranch: 'main',
  workBranchPrefix: 'autodev/',
  autoMerge: false,
  requireBuildPass: true,
  categories: ['security', 'quality', 'performance', 'dependencies', 'tests'],
  notifyWhatsApp: true,
  notifyPhone: '',
};
