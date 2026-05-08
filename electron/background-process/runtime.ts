import type { ManagedSessionRecord, ManagedSessionView } from './types';

export interface BackgroundProcessContext {
  sessions: Map<string, ManagedSessionRecord>;
  ensureStorageRoot: () => Promise<string>;
  createSessionArtifacts: (sessionId: string) => Promise<{
    sessionDir: string;
    stdoutLogPath: string;
    stderrLogPath: string;
    exitStatePath: string;
    metadataPath: string;
  }>;
  ensureSessionsLoaded: () => Promise<void>;
  persistSession: (session: ManagedSessionRecord) => Promise<void>;
  createSessionRecord: (
    partial: Omit<ManagedSessionRecord, 'id' | 'startedAt' | 'status'>,
  ) => ManagedSessionRecord;
  refreshSession: (session: ManagedSessionRecord) => Promise<ManagedSessionRecord>;
  toView: (session: ManagedSessionRecord) => Promise<ManagedSessionView>;
}
