import { hasIndependentTeamWork, requestedTeamMode, selectTeam, teamRequestText, type TeamMode } from './agent-teams/policy';
import { SOFLIA_DEFAULT_MODEL, SOFLIA_LITE_MODEL, SOFLIA_MAX_MODEL, SOFLIA_RUNTIME_MODEL } from './soflia-runtime-model';

export const BACKGROUND_MODELS = [SOFLIA_RUNTIME_MODEL, SOFLIA_LITE_MODEL, SOFLIA_MAX_MODEL, SOFLIA_DEFAULT_MODEL, 'gpt-5.6-luna'] as const;
export const BACKGROUND_LIMITS = { history: 30, admitted: 6, concurrentJobs: 1, workers: 2, rounds: 12, calls: 42, tools: 60, tokens: 160_000, timeoutMs: 600_000, sourceChars: 32_000, artifactBytes: 2_000_000, artifacts: 12 } as const;
export type BackgroundStatus = 'queued' | 'running' | 'verifying' | 'paused' | 'completed' | 'failed' | 'cancelled' | 'interrupted';
export type BackgroundScope = { userId: string; organizationId: string | null; dataUserId: string | null };
export type BackgroundAgent = { role: string; instruction: string; status: 'pending' | 'running' | 'completed' | 'failed'; operation: string; output: string; calls: number };
export type BackgroundArtifact = { id: string; role: string; name: string; format: 'md' | 'txt' | 'csv' | 'docx' | 'pptx' | 'xlsx'; bytes: number; hash: string; inputHash: string; verified: boolean };
export type BackgroundSource = { uri: string; title: string; role: string };
export type BackgroundAction = { id: string; role: string; tool: string; status: 'running' | 'completed' | 'failed' | 'cancelled'; at: string; artifactId?: string };
export interface BackgroundJob {
  id: string; requestId: string; conversationId: string; scope: BackgroundScope; task: string; source: string;
  expectedOwnerId: string; expectedOrganizationId: string | null;
  messageId?: string;
  model: string; effort: string; allowResearch: boolean; status: BackgroundStatus; agents: BackgroundAgent[]; artifacts: BackgroundArtifact[];
  createdAt: string; updatedAt: string; sequence: number; calls: number; tools: number; tokens: number; activeMs: number;
  summary: string; error: string | null;
  sources: BackgroundSource[];
  actions: BackgroundAction[];
}
export type BackgroundStart = { requestId: string; conversationId: string; task: string; source: string; model: string; effort: string; allowResearch: boolean;
  expectedOwnerId: string; expectedOrganizationId: string | null; messageId: string };
export type BackgroundState = { scope: BackgroundScope; jobs: BackgroundJob[]; persistence: 'encrypted' };
export type BackgroundReply<T> = { success: true; data: T } | { success: false; error: string };
export interface BackgroundTeamsBridge {
  context(input: { organizationId: string | null }): Promise<BackgroundReply<BackgroundState>>;
  release(): Promise<BackgroundReply<null>>;
  state(): Promise<BackgroundReply<BackgroundState>>;
  start(input: BackgroundStart): Promise<BackgroundReply<BackgroundJob>>;
  control(input: { jobId: string; action: 'pause' | 'resume' | 'cancel' }): Promise<BackgroundReply<BackgroundJob>>;
  open(input: { jobId: string; artifactId: string }): Promise<BackgroundReply<null>>;
  attachLegacy(input: { jobId: string; messageId: string; conversationId: string }): Promise<BackgroundReply<null>>;
  onChanged(listener: () => void): () => void;
}
export function wantsBackgroundTeam(task: string, mode?: TeamMode): boolean {
  const clean = teamRequestText(task);
  if (/\b(?:sin\s+(?:trabajar\s+)?|no\s+(?:trabaj\w*\s+)?)(?:en\s+)?segundo plano\b/.test(clean)) return false;
  // Estos encargos conservan el ejecutor supervisado existente del chat.
  if (/\b(pdf|envia\w*|publica\w*|borra\w*|elimina\w*|compra\w*|paga\w*|controla la pantalla)\b/.test(clean)
    || /\b(pagina|pestana|documento)\s+(actual|activa|activo|visible)\b/.test(clean)) return false;
  const explicitBackground = /\b(?:en segundo plano|en el fondo)\b/i.test(clean) && !/\b(?:no|sin)\s+(?:trabaj\w*\s+)?(?:en\s+)?segundo plano\b/i.test(clean);
  const requested = requestedTeamMode(task, mode);
  if (requested === 'direct') return false;
  const plan = selectTeam({ task, surface: 'chat', mode: requested === 'team' || explicitBackground ? 'team' : 'auto' });
  if (!plan) return false;
  if (requested === 'team' || explicitBackground) return true;
  // Una conversión o retoque aislado conserva el flujo directo y sus herramientas.
  if (/\b(convierte\w*|convier\w*|exporta\w*|pasa\w*|guarda\w*)\b/.test(clean) && !hasIndependentTeamWork(task)) return false;
  return plan.kind === 'document' || plan.kind === 'presentation' || hasIndependentTeamWork(task);
}
export const isActiveBackgroundJob = (job: Pick<BackgroundJob, 'status'>) => ['queued', 'running', 'verifying'].includes(job.status);
export function sameBackgroundScope(a: BackgroundScope, b: BackgroundScope): boolean {
  return a.userId === b.userId && a.organizationId === b.organizationId && a.dataUserId === b.dataUserId;
}

