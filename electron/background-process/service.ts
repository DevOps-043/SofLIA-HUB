import { app } from 'electron';
import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getFallbackStorageRoot } from './storage';
import { createSessionArtifacts, createSessionRecord, ensureSessionsLoaded, persistSession } from './session-store';
import { launchApplication } from './launch-application';
import { getSession, killSession, listSessions } from './session-management';
import { startBackgroundCommand } from './start-background-command';
import { startVisibleTerminal } from './start-visible-terminal';
import { refreshSession, toSessionView } from './session-view';
import type { BackgroundProcessContext } from './runtime';
import type { LaunchApplicationOptions, ManagedSessionRecord, ManagedSessionView, StartBackgroundCommandOptions, StartVisibleTerminalOptions } from './types';

export class BackgroundProcessService extends EventEmitter {
  private readonly sessions = new Map<string, ManagedSessionRecord>();
  private storageRootPromise: Promise<string> | null = null;
  private sessionsLoaded = false;

  async startBackgroundCommand(options: StartBackgroundCommandOptions): Promise<ManagedSessionView> {
    return startBackgroundCommand(this.context(), options);
  }

  async startVisibleTerminal(options: StartVisibleTerminalOptions): Promise<ManagedSessionView> {
    return startVisibleTerminal(this.context(), options);
  }

  async launchApplication(options: LaunchApplicationOptions): Promise<ManagedSessionView> {
    return launchApplication(this.context(), options);
  }

  async listSessions(): Promise<ManagedSessionView[]> { return listSessions(this.context()); }
  async getSession(sessionId: string): Promise<ManagedSessionView | null> { return getSession(this.context(), sessionId); }
  async killSession(sessionId: string): Promise<ManagedSessionView | null> { return killSession(this.context(), sessionId); }

  private async ensureStorageRoot(): Promise<string> {
    if (!this.storageRootPromise) {
      this.storageRootPromise = (async () => {
        let root = getFallbackStorageRoot();
        try {
          root = path.join(app.getPath('userData'), 'background-processes');
        } catch {
          root = getFallbackStorageRoot();
        }
        await fs.mkdir(root, { recursive: true });
        return root;
      })();
    }
    return this.storageRootPromise;
  }

  private context(): BackgroundProcessContext {
    const context: BackgroundProcessContext = {
      sessions: this.sessions,
      ensureStorageRoot: () => this.ensureStorageRoot(),
      createSessionArtifacts: (sessionId) => createSessionArtifacts(() => this.ensureStorageRoot(), sessionId),
      ensureSessionsLoaded: () => ensureSessionsLoaded(context, () => { this.sessionsLoaded = true; }, () => this.sessionsLoaded),
      persistSession,
      createSessionRecord,
      refreshSession: (session) => refreshSession(context, session),
      toView: (session) => toSessionView(context, session),
    };
    return context;
  }
}

export const backgroundProcessService = new BackgroundProcessService();
