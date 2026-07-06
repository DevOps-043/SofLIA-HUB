import type { ActionHistoryEntry, AgentStatus, AgentTask, DesktopAgentConfig, DesktopAgentStatus, TaskPlan } from '../desktop-agent-types';
import type { PlatformCapabilities } from '../platform-capabilities';

type BackendRuntimeStatus = {
  status: string;
  currentTask?: string | null;
  currentStep: number;
  maxSteps?: number;
  currentUrl?: string | null;
  currentProfileId?: string | null;
  currentProfileMode?: 'persistent' | 'isolated' | null;
  lastVerification?: string | null;
  lastTracePath?: string | null;
  lastReportPath?: string | null;
  lastScreenshotPath?: string | null;
  lastAction?: string | null;
};

export type DesktopAgentStatusSnapshotContext = {
  activeTasks: Iterable<AgentTask>;
  browserStatus: BackendRuntimeStatus;
  windowsUIAStatus: BackendRuntimeStatus;
  actionHistory: ActionHistoryEntry[];
  status: AgentStatus;
  currentTask: string | null;
  currentStep: number;
  currentPlan: TaskPlan | null;
  config: DesktopAgentConfig;
  platformCapabilities: PlatformCapabilities;
};

function isActive(status: BackendRuntimeStatus): boolean { return status.status !== 'idle'; }

function backendValue<T>(browserStatus: BackendRuntimeStatus, windowsUIAStatus: BackendRuntimeStatus, key: keyof BackendRuntimeStatus, fallback: T): T {
  if (isActive(browserStatus)) return (browserStatus[key] as T) ?? fallback;
  if (isActive(windowsUIAStatus)) return (windowsUIAStatus[key] as T) ?? fallback;
  return ((browserStatus[key] as T) ?? (windowsUIAStatus[key] as T) ?? fallback);
}

export function buildDesktopAgentStatus(context: DesktopAgentStatusSnapshotContext): DesktopAgentStatus {
  const browserActive = isActive(context.browserStatus);
  const windowsUIAActive = isActive(context.windowsUIAStatus);
  const activeTasksList: DesktopAgentStatus['activeTasks'] = Array.from(context.activeTasks).map(task => ({
    id: task.id,
    task: task.task,
    status: task.status,
    step: task.currentStep,
    maxSteps: task.maxSteps,
    backend: 'desktop_visual' as const,
    currentUrl: null,
  }));

  if (browserActive) {
    activeTasksList.push({
      id: 'browser-web',
      task: context.browserStatus.currentTask || 'Tarea web',
      status: 'executing',
      step: context.browserStatus.currentStep,
      maxSteps: context.browserStatus.maxSteps || context.config.maxSteps,
      backend: 'browser_web',
      currentUrl: context.browserStatus.currentUrl || null,
      browserProfileId: context.browserStatus.currentProfileId,
      browserProfileMode: context.browserStatus.currentProfileMode,
    });
  }

  if (windowsUIAActive) {
    activeTasksList.push({
      id: 'windows-uia',
      task: context.windowsUIAStatus.currentTask || 'Tarea nativa',
      status: 'executing',
      step: context.windowsUIAStatus.currentStep,
      maxSteps: context.windowsUIAStatus.maxSteps || context.config.maxSteps,
      backend: 'windows_uia',
      currentUrl: null,
    });
  }

  const lastDesktopAction = context.actionHistory[context.actionHistory.length - 1]?.action.message || null;
  const currentTask = backendValue(context.browserStatus, context.windowsUIAStatus, 'currentTask', context.currentTask);

  return {
    status: browserActive || windowsUIAActive ? 'executing' : context.status,
    currentTask: currentTask || null,
    currentStep: backendValue(context.browserStatus, context.windowsUIAStatus, 'currentStep', context.currentStep),
    maxSteps: backendValue(context.browserStatus, context.windowsUIAStatus, 'maxSteps', context.config.maxSteps),
    currentBackend: browserActive ? 'browser_web' : windowsUIAActive ? 'windows_uia' : (context.currentTask ? 'desktop_visual' : null),
    currentUrl: browserActive ? context.browserStatus.currentUrl || null : null,
    currentBrowserProfileId: context.browserStatus.currentProfileId,
    currentBrowserProfileMode: context.browserStatus.currentProfileMode,
    lastVerification: backendValue(context.browserStatus, context.windowsUIAStatus, 'lastVerification', null),
    lastTracePath: backendValue(context.browserStatus, context.windowsUIAStatus, 'lastTracePath', null),
    lastReportPath: backendValue(context.browserStatus, context.windowsUIAStatus, 'lastReportPath', null),
    lastScreenshotPath: backendValue(context.browserStatus, context.windowsUIAStatus, 'lastScreenshotPath', null),
    plan: context.currentPlan ? { ...context.currentPlan } : null,
    lastAction: backendValue(context.browserStatus, context.windowsUIAStatus, 'lastAction', lastDesktopAction),
    config: context.config,
    platformCapabilities: context.platformCapabilities,
    activeTasks: activeTasksList,
    totalActiveAgents: activeTasksList.length,
  };
}
