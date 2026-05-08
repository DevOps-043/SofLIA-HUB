import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import { readTextTail } from './storage';
import { execFileAsync } from './process-exec';
import type { ManagedSessionRecord, ManagedSessionView, SessionExitState } from './types';
import type { BackgroundProcessContext } from './runtime';

export async function isPidRunning(pid: number | undefined): Promise<boolean> {
  if (!pid || !Number.isFinite(pid) || pid <= 0) return false;
  if (process.platform === 'win32') {
    try {
      const { stdout } = await execFileAsync('powershell.exe', [
        '-NoProfile',
        '-Command',
        `if (Get-Process -Id ${pid} -ErrorAction SilentlyContinue) { 'running' }`,
      ], { timeout: 4000, windowsHide: true, maxBuffer: 1024 * 64 });
      return String(stdout || '').trim().toLowerCase() === 'running';
    } catch {
      return false;
    }
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function readExitState(session: ManagedSessionRecord): Promise<SessionExitState | null> {
  if (!session.exitStatePath || !fsSync.existsSync(session.exitStatePath)) return null;
  try {
    const parsed = JSON.parse(await fs.readFile(session.exitStatePath, 'utf8'));
    return {
      exitCode: typeof parsed?.exitCode === 'number' ? parsed.exitCode : null,
      finishedAt: typeof parsed?.finishedAt === 'string' ? parsed.finishedAt : undefined,
    };
  } catch {
    return null;
  }
}

export async function refreshSession(
  context: BackgroundProcessContext,
  session: ManagedSessionRecord,
): Promise<ManagedSessionRecord> {
  const previous = { status: session.status, endedAt: session.endedAt, exitCode: session.exitCode };
  const exitState = await readExitState(session);
  if (exitState) {
    session.exitCode = exitState.exitCode ?? session.exitCode ?? null;
    session.endedAt = exitState.finishedAt || session.endedAt || new Date().toISOString();
    if (session.status !== 'killed') session.status = (session.exitCode ?? 0) === 0 ? 'completed' : 'failed';
    return session;
  }
  const running = await isPidRunning(session.pid);
  if (!running && session.status === 'running') {
    session.endedAt = session.endedAt || new Date().toISOString();
    session.status = session.mode === 'background' ? 'unknown' : 'completed';
  }
  if (session.status !== previous.status || session.endedAt !== previous.endedAt || session.exitCode !== previous.exitCode) {
    await context.persistSession(session);
  }
  return session;
}

export async function toSessionView(
  context: BackgroundProcessContext,
  session: ManagedSessionRecord,
): Promise<ManagedSessionView> {
  await context.refreshSession(session);
  return {
    id: session.id, kind: session.kind, mode: session.mode, title: session.title, status: session.status,
    command: session.command, targetPath: session.targetPath, workingDirectory: session.workingDirectory,
    pid: session.pid, visible: session.visible, keepOpen: session.keepOpen, startedAt: session.startedAt,
    endedAt: session.endedAt, exitCode: session.exitCode, lastError: session.lastError,
    outputAvailable: session.outputAvailable,
    stdoutTail: session.outputAvailable ? await readTextTail(session.stdoutLogPath) : '',
    stderrTail: session.outputAvailable ? await readTextTail(session.stderrLogPath) : '',
    metadata: session.metadata,
  };
}
