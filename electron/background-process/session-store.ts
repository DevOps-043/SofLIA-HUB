import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ManagedSessionRecord } from './types';
import type { BackgroundProcessContext } from './runtime';

export async function createSessionArtifacts(
  ensureStorageRoot: () => Promise<string>,
  sessionId: string,
) {
  const root = await ensureStorageRoot();
  const sessionDir = path.join(root, sessionId);
  await fs.mkdir(sessionDir, { recursive: true });
  return {
    sessionDir,
    stdoutLogPath: path.join(sessionDir, 'stdout.log'),
    stderrLogPath: path.join(sessionDir, 'stderr.log'),
    exitStatePath: path.join(sessionDir, 'exit-state.json'),
    metadataPath: path.join(sessionDir, 'session.json'),
  };
}

export async function ensureSessionsLoaded(
  context: BackgroundProcessContext,
  markLoaded: () => void,
  isLoaded: () => boolean,
): Promise<void> {
  if (isLoaded()) return;
  const root = await context.ensureStorageRoot();
  let entries: fsSync.Dirent[] = [];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    markLoaded();
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const metadataPath = path.join(root, entry.name, 'session.json');
    if (!fsSync.existsSync(metadataPath)) continue;
    try {
      const session = JSON.parse(await fs.readFile(metadataPath, 'utf8')) as ManagedSessionRecord;
      if (session?.id && !context.sessions.has(session.id)) context.sessions.set(session.id, session);
    } catch {
      // Ignore malformed persisted sessions.
    }
  }
  markLoaded();
}

export async function persistSession(session: ManagedSessionRecord): Promise<void> {
  if (!session.metadataPath) return;
  try {
    await fs.writeFile(session.metadataPath, JSON.stringify(session, null, 2), 'utf8');
  } catch {
    // Persistence is best-effort; runtime tracking stays in memory.
  }
}

export function createSessionRecord(
  partial: Omit<ManagedSessionRecord, 'id' | 'startedAt' | 'status'>,
): ManagedSessionRecord {
  return {
    id: randomUUID(),
    startedAt: new Date().toISOString(),
    status: 'running',
    ...partial,
  };
}
