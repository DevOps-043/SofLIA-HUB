import type { ActionHistoryEntry, DesktopAgentConfig, TaskPlan } from './task-types';
import type { PlatformCapabilities } from '../platform-capabilities';

export interface TaskPhase {
  name: string;
  description: string;
  successCriteria: string;
  subGoals: string[];
  currentSubGoalIndex: number;
  estimatedSteps: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startStep?: number;
  endStep?: number;
}

export interface UIElement {
  id: number;
  name: string;
  controlType: string;
  boundingRect: { x: number; y: number; width: number; height: number };
  isEnabled: boolean;
  automationId?: string;
  value?: string;
}

export interface HistorySummary {
  fromStep: number;
  toStep: number;
  summary: string;
}

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
