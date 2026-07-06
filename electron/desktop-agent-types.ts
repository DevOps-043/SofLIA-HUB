export type { DesktopAgentConfig } from './desktop-agent/agent-config';
export { DEFAULT_CONFIG, loadConfig, saveConfig } from './desktop-agent/agent-config';
export type {
  ActionHistoryEntry,
  DesktopAction,
  DesktopActionPayload,
  FailedActionTargetMemory,
  ResolvedActionTarget,
  TargetWindowLock,
} from './desktop-agent/action-types';
export type {
  HistorySummary,
  StrategicPlan,
  TaskPhase,
  TaskPlan,
  UIElement,
} from './desktop-agent/planning-types';
export type {
  AgentStatus,
  AgentTask,
  DesktopAgentStatus,
  RecoveryContext,
} from './desktop-agent/task-status-types';
export {
  LEFTDOWN,
  LEFTUP,
  PINVOKE_HEADER,
  RIGHTDOWN,
  RIGHTUP,
  SEND_KEYS_MAP,
  WHEEL,
} from './desktop-agent/key-map';
