import { spawn } from 'node:child_process';
import os from 'node:os';
import { buildVisibleTerminalScript, encodeUtf16Base64 } from './scripts';
import type { BackgroundProcessContext } from './runtime';
import type { ManagedSessionView, StartVisibleTerminalOptions } from './types';

export async function startVisibleTerminal(
  context: BackgroundProcessContext,
  options: StartVisibleTerminalOptions,
): Promise<ManagedSessionView> {
  await context.ensureSessionsLoaded();
  const workingDirectory = options.workingDirectory || os.homedir();
  const session = context.createSessionRecord({
    kind: options.kind || 'command',
    mode: 'visible-terminal',
    title: options.title || 'Terminal administrada',
    command: options.command,
    workingDirectory,
    visible: true,
    keepOpen: options.keepOpen !== false,
    outputAvailable: false,
    metadata: options.metadata,
  });
  const artifacts = await context.createSessionArtifacts(session.id);
  session.sessionDir = artifacts.sessionDir;
  session.metadataPath = artifacts.metadataPath;

  const args = ['-NoProfile'];
  if (session.keepOpen) args.push('-NoExit');
  args.push('-EncodedCommand', encodeUtf16Base64(buildVisibleTerminalScript(options.command, workingDirectory)));
  const child = spawn('powershell.exe', args, {
    cwd: workingDirectory,
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  });
  session.pid = child.pid;
  context.sessions.set(session.id, session);
  await context.persistSession(session);
  child.once('error', (error) => {
    session.lastError = error.message;
    session.status = 'failed';
    session.endedAt = new Date().toISOString();
    void context.persistSession(session);
  });
  child.once('exit', (code) => {
    if (session.status !== 'running') return;
    session.exitCode = typeof code === 'number' ? code : null;
    session.endedAt = new Date().toISOString();
    session.status = session.exitCode !== null && session.exitCode !== 0 ? 'failed' : 'completed';
    void context.persistSession(session);
  });
  child.unref();
  return context.toView(session);
}
