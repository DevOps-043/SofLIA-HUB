/** Contratos cerrados de la plataforma del navegador. No contienen secretos. */

export const BROWSER_DOWNLOAD_STATES = [
  'pending',
  'progressing',
  'paused',
  'completed',
  'cancelled',
  'interrupted',
  'blocked',
] as const;
export type BrowserDownloadState = (typeof BROWSER_DOWNLOAD_STATES)[number];

export interface BrowserDownloadRecord {
  id: string;
  filename: string;
  origin: string;
  receivedBytes: number;
  totalBytes: number;
  progress: number | null;
  state: BrowserDownloadState;
  canResume: boolean;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
}

export interface BrowserFindState {
  query: string;
  activeMatchOrdinal: number;
  matches: number;
  finalUpdate: boolean;
}

export interface BrowserPageToolsState {
  zoomFactor: number;
  muted: boolean;
  fullscreen: boolean;
  find: BrowserFindState | null;
}

export const BROWSER_TAB_GROUP_COLORS = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan'] as const;
export type BrowserTabGroupColor = (typeof BROWSER_TAB_GROUP_COLORS)[number];

export interface BrowserTabGroup {
  id: string;
  name: string;
  color: BrowserTabGroupColor;
  collapsed: boolean;
}

export interface BrowserSessionTab {
  id: string;
  url: string;
  title: string;
  pinned: boolean;
  muted: boolean;
  groupId: string | null;
  position: number;
}

export interface BrowserRecentlyClosedTab {
  id: string;
  url: string;
  title: string;
  closedAt: string;
}

export interface BrowserHistoryRetention {
  days: number | null;
  managed: boolean;
}

export interface BrowserSessionSnapshot {
  version: 2;
  savedAt: string;
  cleanExit: boolean;
  activeTabId: string | null;
  primaryTabId: string | null;
  secondaryTabId: string | null;
  detachedTabIds: string[];
  viewMode: 'single' | 'split' | 'overlay';
  tabLayout: 'horizontal' | 'vertical';
  tabs: BrowserSessionTab[];
  groups: BrowserTabGroup[];
}

export type BrowserProfileKind = 'authenticated' | 'guest' | 'private';
export interface BrowserProfileDescriptor {
  id: string;
  kind: BrowserProfileKind;
  label: string;
  persistent: boolean;
  managed: boolean;
}

export interface BrowserBookmark {
  id: string;
  url: string;
  title: string;
  folderId: string | null;
  tags: string[];
  position: number;
  createdAt: string;
  updatedAt: string;
}

export type BrowserPrivacyLevel = 'off' | 'balanced' | 'strict';
export type BrowserPrivacyCategory = 'tracker' | 'advertising' | 'third-party-cookie' | 'tracking-parameter' | 'fingerprinting' | 'malware';
export interface BrowserPrivacySiteState {
  enabled?: boolean;
  managed?: boolean;
  origin: string;
  level: BrowserPrivacyLevel;
  blocked: Partial<Record<BrowserPrivacyCategory, number>>;
  exceptionCategories: BrowserPrivacyCategory[];
  degraded: boolean;
}

export type BrowserAgentPolicyMode = 'strict' | 'balanced';
export type BrowserAgentSiteDecision = 'ask' | 'allow-once' | 'allow-always' | 'block';
export type BrowserAgentCapability = 'observe-dom' | 'capture' | 'read-document' | 'act';
export interface BrowserAgentSitePolicy {
  enabled?: boolean;
  origin: string;
  mode: BrowserAgentPolicyMode;
  decision: BrowserAgentSiteDecision;
  managed: boolean;
  updatedAt: string;
}

export interface BrowserAgentPolicyPromptRequest {
  id: string;
  origin: string;
  capability: BrowserAgentCapability;
  label: string;
}

export type BrowserSyncCategory = 'bookmarks' | 'groups' | 'tabs' | 'settings';
export interface BrowserSyncDeviceStatus {
  enabled: boolean;
  state: 'disabled' | 'inactive' | 'registered';
  message: string;
  canceled?: boolean;
  devices: Array<{ id: string; label: string; current: boolean; createdAt: string; revokedAt: string | null }>;
}
export type BrowserSyncState = 'disabled' | 'ready' | 'syncing' | 'degraded' | 'error';
export interface BrowserSyncControlStatus {
  enabled: boolean;
  keyAvailable: boolean;
  categories: BrowserSyncCategory[];
  lastSyncedAt: string | null;
  state: 'disabled' | 'ready' | 'idle' | 'conflict' | 'initial-review' | 'local-changed';
  completed: BrowserSyncCategory[];
  initialCategories: BrowserSyncCategory[];
  conflicts: Array<{ reviewId: string; category: BrowserSyncCategory; count: number }>;
  canceled?: boolean;
}
export type BrowserSyncControlRequest =
  | { action: 'status' | 'run' | 'pause' | 'export-key' | 'import-key' | 'recover-settings' | 'recover-state' | 'rollback-state' }
  | { action: 'configure'; categories: BrowserSyncCategory[] }
  | { action: 'resolve'; category: BrowserSyncCategory; choice: 'local' | 'remote'; reviewId?: string };
export interface BrowserSyncStatus {
  state: BrowserSyncState;
  categories: BrowserSyncCategory[];
  lastSyncedAt: string | null;
  pending: number;
  conflictCount: number;
  error: string | null;
}

export interface BrowserRuntimeDiagnostic {
  appVersion: string;
  electronVersion: string;
  chromiumVersion: string;
  nodeVersion: string;
  profileKind: BrowserProfileKind;
  protectionLevel: BrowserPrivacyLevel;
  managed: boolean;
  enterprisePolicyStatus?: 'disabled' | 'loading' | 'ready' | 'error';
  checkedAt: string;
}

export interface BrowserEnterprisePolicy {
  version: 1;
  blockedOrigins: string[];
  forcedPrivacyLevel: BrowserPrivacyLevel | null;
  extensionsAllowed: boolean;
  agentAllowed: boolean;
  historyRetentionDays: number | null;
}
