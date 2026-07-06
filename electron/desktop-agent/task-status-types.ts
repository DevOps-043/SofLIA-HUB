import type { ActionHistoryEntry } from './action-types';
import type { DesktopAgentConfig } from './agent-config';
import type { TaskPlan } from './planning-types';
import type { PlatformCapabilities } from '../platform-capabilities';

export type AgentStatus = 'idle' | 'executing' | 'observing' | 'planning' | 'waiting' | 'recovering';

export interface RecoveryContext {
  consecutiveFailures: number;
  sameScreenCount: number;
  lastScreenHash: string;
  totalRecoveries: number;
  lastRecoveryStep: number;
}

export interface AgentTask {
  id: string;
  task: string;
  status: AgentStatus;
  currentStep: number;
  maxSteps: number;
  plan: TaskPlan | null;
  actionHistory: ActionHistoryEntry[];
  recovery: RecoveryContext;
  abortController: AbortController;
  startedAt: number;
  completedAt?: number;
  result?: string;
  error?: string;
}

export interface DesktopAgentStatus {
  status: AgentStatus;
  currentTask: string | null;
  currentStep: number;
  maxSteps: number;
  currentBackend?: 'desktop_visual' | 'browser_web' | 'windows_uia' | null;
  currentUrl?: string | null;
  currentBrowserProfileId?: string | null;
  currentBrowserProfileMode?: 'persistent' | 'isolated' | null;
  lastVerification?: string | null;
  lastTracePath?: string | null;
  lastReportPath?: string | null;
  lastScreenshotPath?: string | null;
  plan: TaskPlan | null;
  lastAction: string | null;
  config: DesktopAgentConfig;
  platformCapabilities?: PlatformCapabilities;
  activeTasks: Array<{
    id: string;
    task: string;
    status: AgentStatus;
    step: number;
    maxSteps: number;
    backend?: 'desktop_visual' | 'browser_web' | 'windows_uia';
    currentUrl?: string | null;
    browserProfileId?: string | null;
    browserProfileMode?: 'persistent' | 'isolated' | null;
  }>;
  totalActiveAgents: number;
}
