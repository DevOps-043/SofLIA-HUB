import type { Page } from 'playwright-core';
import type {
  BrowserActionPayload,
  BrowserHistoryEntry,
  BrowserPageSnapshot,
  BrowserProfileDescriptor,
  BrowserTaskArtifacts,
  BrowserTaskOptions,
  BrowserTaskStatus,
} from './types';

export type PlaywrightModule = typeof import('playwright-core');
export type BrowserWebConstructor = { prototype: any };

export interface BrowserWebLifecycleApi {
  setApiKey(key: string): void;
  getStatus(): import('./types').BrowserStatusSnapshot;
  isRunning(): boolean;
  abortAll(): void;
  processQueue(): void;
}

export interface BrowserWebProfileApi {
  listProfiles(): BrowserProfileDescriptor[];
  resetProfile(profileId: string): Promise<{ success: boolean; profileId: string; path: string; removed: boolean }>;
  getProfilesBaseDir(): string;
  sanitizeProfileId(profileId: string): string;
  resolveProfileId(profileId?: string): string;
  getProfileDirectory(profileId: string): string;
}

export interface BrowserWebRuntimeApi {
  executeTask(task: string, options?: BrowserTaskOptions): Promise<string>;
  executeTaskInternal(task: string, options?: BrowserTaskOptions): Promise<string>;
  createTaskArtifacts(task: string): BrowserTaskArtifacts;
  startTaskTrace(): Promise<{ success: boolean; error: string | null }>;
  finalizeTaskArtifacts(params: import('./service-artifacts').FinalizeBrowserTaskArtifactsParams): Promise<void>;
}

export interface BrowserWebEngineApi {
  getPlaywright(): Promise<PlaywrightModule>;
  ensurePage(options?: BrowserTaskOptions): Promise<any>;
  disposeBrowserResources(): Promise<void>;
  launchBrowser(playwright: PlaywrightModule): Promise<any>;
  launchPersistentContext(playwright: PlaywrightModule, profileId: string): Promise<any>;
  shouldNavigateToStartUrl(page: Page, startUrl: string): boolean;
  collectSnapshot(page: Page, signal?: AbortSignal): Promise<BrowserPageSnapshot>;
  decideNextAction(task: string, snapshot: BrowserPageSnapshot, history: BrowserHistoryEntry[], signal?: AbortSignal): Promise<BrowserActionPayload>;
  executeAction(page: Page, action: BrowserActionPayload, signal?: AbortSignal): Promise<void>;
}

export type BrowserTaskFinalStatus = 'completed' | 'failed' | 'cancelled' | 'error';
export type BrowserTaskMutableState = {
  history: BrowserHistoryEntry[];
  finalSnapshot: BrowserPageSnapshot | null;
  finalStatus: BrowserTaskFinalStatus;
  finalMessage: string;
  traceStarted: boolean;
  traceStartError: string | null;
};

export type BrowserWebServiceState = {
  status: BrowserTaskStatus;
  queue: Array<import('./types').BrowserQueueEntry>;
};
