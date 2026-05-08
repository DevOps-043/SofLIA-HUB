import { spawn } from 'node:child_process';
import fsSync from 'node:fs';
import os from 'node:os';
import {
  buildBackgroundScript,
  encodeUtf16Base64,
} from './scripts';
import type { BackgroundProcessContext } from './runtime';
import type { ManagedSessionView, StartBackgroundCommandOptions } from './types';

export async function startBackgroundCommand(
  context: BackgroundProcessContext,
  options: StartBackgroundCommandOptions,
): Promise<ManagedSessionView> {
  await context.ensureSessionsLoaded();
  const workingDirectory = options.workingDirectory || os.homedir();
  const session = context.createSessionRecord({
    kind: options.kind || 'command',
    mode: 'background',
    title: options.title || 'Comando en segundo plano',
    command: options.command,
    workingDirectory,
    visible: false,
    keepOpen: false,
    outputAvailable: true,
    metadata: options.metadata,
  });
  const artifacts = await context.createSessionArtifacts(session.id);
  Object.assign(session, artifacts);
  const outFd = fsSync.openSync(artifacts.stdoutLogPath, 'a');
  const errFd = fsSync.openSync(artifacts.stderrLogPath, 'a');

  try {
    const script = buildBackgroundScript(options.command, workingDirectory, artifacts.exitStatePath);
    const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encodeUtf16Base64(script)], {
      cwd: workingDirectory,
      detached: true,
      stdio: ['ignore', outFd, errFd],
      windowsHide: true,
    });
    session.pid = child.pid;
    context.sessions.set(session.id, session);
    await context.persistSession(session);
    child.once('error', (error) => markSessionFailed(context, session, error.message));
    child.once('exit', (code) => markSessionExited(context, session, code));
    child.unref();
  } finally {
    fsSync.closeSync(outFd);
    fsSync.closeSync(errFd);
  }
  return context.toView(session);
}

function markSessionFailed(context: BackgroundProcessContext, session: any, error: string): void {
  session.lastError = error;
  session.status = 'failed';
  session.endedAt = new Date().toISOString();
  void context.persistSession(session);
}

function markSessionExited(context: BackgroundProcessContext, session: any, code: number | null): void {
  if (session.status !== 'running') return;
  session.exitCode = typeof code === 'number' ? code : null;
  session.endedAt = new Date().toISOString();
  session.status = (session.exitCode ?? 0) === 0 ? 'completed' : 'failed';
  void context.persistSession(session);
}
