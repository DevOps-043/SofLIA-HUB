import { shell } from 'electron';
import path from 'node:path';
import { encodeUtf16Base64, escapePowerShellSingleQuoted } from './scripts';
import { execFileAsync } from './process-exec';
import type { BackgroundProcessContext } from './runtime';
import type { LaunchApplicationOptions, ManagedSessionRecord, ManagedSessionView } from './types';

export async function launchApplication(
  context: BackgroundProcessContext,
  options: LaunchApplicationOptions,
): Promise<ManagedSessionView> {
  await context.ensureSessionsLoaded();
  const session = context.createSessionRecord({
    kind: 'application',
    mode: 'application',
    title: options.title || `Aplicacion: ${path.basename(options.targetPath)}`,
    targetPath: options.targetPath,
    workingDirectory: path.dirname(options.targetPath),
    visible: true,
    keepOpen: false,
    outputAvailable: false,
    metadata: options.metadata,
  });
  const artifacts = await context.createSessionArtifacts(session.id);
  session.sessionDir = artifacts.sessionDir;
  session.metadataPath = artifacts.metadataPath;
  await openApplicationTarget(context, session, options.targetPath);
  context.sessions.set(session.id, session);
  await context.persistSession(session);
  return context.toView(session);
}

async function openApplicationTarget(
  context: BackgroundProcessContext,
  session: ManagedSessionRecord,
  targetPath: string,
): Promise<void> {
  if (process.platform !== 'win32') {
    const openResult = await shell.openPath(targetPath);
    if (openResult) markFailed(session, openResult);
    return;
  }
  const targetEncoded = encodeUtf16Base64([
    `$targetPath = '${escapePowerShellSingleQuoted(targetPath)}'`,
    '$proc = Start-Process -FilePath $targetPath -PassThru -ErrorAction Stop',
    '$payload = @{ pid = $proc.Id; processName = $proc.ProcessName } | ConvertTo-Json -Compress',
    '[Console]::Out.WriteLine($payload)',
  ].join('\n'));
  try {
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-EncodedCommand', targetEncoded], {
      timeout: 10000,
      windowsHide: true,
      maxBuffer: 1024 * 128,
    });
    const parsed = JSON.parse(String(stdout || '{}').trim() || '{}');
    if (typeof parsed?.pid === 'number') session.pid = parsed.pid;
  } catch (error: any) {
    markFailed(session, error?.stderr?.trim() || error?.stdout?.trim() || error?.message || 'No se pudo abrir la aplicacion.');
    context.sessions.set(session.id, session);
    await context.persistSession(session);
  }
}

function markFailed(session: ManagedSessionRecord, error: string): void {
  session.status = 'failed';
  session.lastError = error;
  session.endedAt = new Date().toISOString();
}
