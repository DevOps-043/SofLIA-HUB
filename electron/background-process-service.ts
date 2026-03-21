import { app, shell } from 'electron';
import { spawn, execFile as execFileCb } from 'node:child_process';
import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFileCb);

export type ManagedSessionKind = 'command' | 'claude' | 'application';
export type ManagedSessionStatus = 'running' | 'completed' | 'failed' | 'killed' | 'unknown';

type ManagedSessionMode = 'background' | 'visible-terminal' | 'application';

type SessionExitState = {
  exitCode?: number | null;
  finishedAt?: string;
};

type ManagedSessionRecord = {
  id: string;
  kind: ManagedSessionKind;
  mode: ManagedSessionMode;
  title: string;
  status: ManagedSessionStatus;
  command?: string;
  targetPath?: string;
  workingDirectory?: string;
  pid?: number;
  visible: boolean;
  keepOpen: boolean;
  startedAt: string;
  endedAt?: string;
  exitCode?: number | null;
  lastError?: string;
  outputAvailable: boolean;
  stdoutLogPath?: string;
  stderrLogPath?: string;
  exitStatePath?: string;
  metadataPath?: string;
  sessionDir?: string;
  metadata?: Record<string, any>;
};

export type ManagedSessionView = {
  id: string;
  kind: ManagedSessionKind;
  mode: ManagedSessionMode;
  title: string;
  status: ManagedSessionStatus;
  command?: string;
  targetPath?: string;
  workingDirectory?: string;
  pid?: number;
  visible: boolean;
  keepOpen: boolean;
  startedAt: string;
  endedAt?: string;
  exitCode?: number | null;
  lastError?: string;
  outputAvailable: boolean;
  stdoutTail?: string;
  stderrTail?: string;
  metadata?: Record<string, any>;
};

export type StartBackgroundCommandOptions = {
  command: string;
  workingDirectory?: string;
  title?: string;
  kind?: ManagedSessionKind;
  metadata?: Record<string, any>;
};

export type StartVisibleTerminalOptions = {
  command: string;
  workingDirectory?: string;
  title?: string;
  keepOpen?: boolean;
  kind?: ManagedSessionKind;
  metadata?: Record<string, any>;
};

export type LaunchApplicationOptions = {
  targetPath: string;
  title?: string;
  metadata?: Record<string, any>;
};

function encodeUtf16Base64(value: string): string {
  return Buffer.from(value, 'utf16le').toString('base64');
}

function encodeUtf8Base64(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64');
}

function escapePowerShellSingleQuoted(value: string): string {
  return value.replace(/'/g, "''");
}

function getFallbackStorageRoot(): string {
  return path.join(os.tmpdir(), 'soflia-background-processes');
}

function buildBackgroundScript(command: string, workingDirectory: string | undefined, exitStatePath: string): string {
  const commandBase64 = encodeUtf8Base64(command);
  const workdirBase64 = encodeUtf8Base64(workingDirectory || '');
  const exitPathBase64 = encodeUtf8Base64(exitStatePath);

  return [
    "$ErrorActionPreference = 'Continue'",
    `$commandText = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${commandBase64}'))`,
    `$workingDirectory = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${workdirBase64}'))`,
    `$exitStatePath = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${exitPathBase64}'))`,
    '$exitCode = 0',
    '$success = $true',
    'try {',
    '  if ($workingDirectory) { Set-Location -LiteralPath $workingDirectory }',
    '  Invoke-Expression $commandText',
    '  $success = $?',
    '  if ($LASTEXITCODE -is [int]) {',
    '    $exitCode = [int]$LASTEXITCODE',
    '  } elseif (-not $success) {',
    '    $exitCode = 1',
    '  } else {',
    '    $exitCode = 0',
    '  }',
    '} catch {',
    '  Write-Error $_',
    '  $exitCode = 1',
    '}',
    "$payload = @{ exitCode = $exitCode; finishedAt = (Get-Date).ToString('o') } | ConvertTo-Json -Compress",
    "Set-Content -LiteralPath $exitStatePath -Value $payload -Encoding UTF8",
    'exit $exitCode',
  ].join('\n');
}

function buildVisibleTerminalScript(command: string, workingDirectory?: string): string {
  const commandBase64 = encodeUtf8Base64(command);
  const workdirBase64 = encodeUtf8Base64(workingDirectory || '');

  return [
    `$commandText = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${commandBase64}'))`,
    `$workingDirectory = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${workdirBase64}'))`,
    'if ($workingDirectory) { Set-Location -LiteralPath $workingDirectory }',
    'Invoke-Expression $commandText',
  ].join('\n');
}

async function readTextTail(filePath: string | undefined, maxChars = 8000): Promise<string> {
  if (!filePath || !fsSync.existsSync(filePath)) {
    return '';
  }

  const handle = await fs.open(filePath, 'r');
  try {
    const stats = await handle.stat();
    if (stats.size <= 0) {
      return '';
    }

    const bytesToRead = Math.min(stats.size, maxChars * 4);
    const offset = Math.max(0, stats.size - bytesToRead);
    const buffer = Buffer.alloc(bytesToRead);
    const { bytesRead } = await handle.read(buffer, 0, bytesToRead, offset);
    return buffer.toString('utf8', 0, bytesRead).slice(-maxChars).trim();
  } finally {
    await handle.close();
  }
}

export class BackgroundProcessService extends EventEmitter {
  private readonly sessions = new Map<string, ManagedSessionRecord>();
  private storageRootPromise: Promise<string> | null = null;
  private sessionsLoaded = false;

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

  private async createSessionArtifacts(sessionId: string) {
    const root = await this.ensureStorageRoot();
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

  private async ensureSessionsLoaded(): Promise<void> {
    if (this.sessionsLoaded) {
      return;
    }

    const root = await this.ensureStorageRoot();
    let entries: fsSync.Dirent[] = [];
    try {
      entries = await fs.readdir(root, { withFileTypes: true });
    } catch {
      this.sessionsLoaded = true;
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const metadataPath = path.join(root, entry.name, 'session.json');
      if (!fsSync.existsSync(metadataPath)) {
        continue;
      }

      try {
        const raw = await fs.readFile(metadataPath, 'utf8');
        const session = JSON.parse(raw) as ManagedSessionRecord;
        if (session?.id && !this.sessions.has(session.id)) {
          this.sessions.set(session.id, session);
        }
      } catch {
        // Ignore malformed persisted sessions.
      }
    }

    this.sessionsLoaded = true;
  }

  private async persistSession(session: ManagedSessionRecord): Promise<void> {
    if (!session.metadataPath) {
      return;
    }

    try {
      await fs.writeFile(session.metadataPath, JSON.stringify(session, null, 2), 'utf8');
    } catch {
      // Persistence is best-effort; runtime tracking stays in memory.
    }
  }

  private createSessionRecord(partial: Omit<ManagedSessionRecord, 'id' | 'startedAt' | 'status'>): ManagedSessionRecord {
    return {
      id: randomUUID(),
      startedAt: new Date().toISOString(),
      status: 'running',
      ...partial,
    };
  }

  private async isPidRunning(pid: number | undefined): Promise<boolean> {
    if (!pid || !Number.isFinite(pid) || pid <= 0) {
      return false;
    }

    if (process.platform === 'win32') {
      try {
        const { stdout } = await execFileAsync('powershell.exe', [
          '-NoProfile',
          '-Command',
          `if (Get-Process -Id ${pid} -ErrorAction SilentlyContinue) { 'running' }`,
        ], {
          timeout: 4000,
          windowsHide: true,
          maxBuffer: 1024 * 64,
        });
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

  private async readExitState(session: ManagedSessionRecord): Promise<SessionExitState | null> {
    if (!session.exitStatePath || !fsSync.existsSync(session.exitStatePath)) {
      return null;
    }

    try {
      const raw = await fs.readFile(session.exitStatePath, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        exitCode: typeof parsed?.exitCode === 'number' ? parsed.exitCode : null,
        finishedAt: typeof parsed?.finishedAt === 'string' ? parsed.finishedAt : undefined,
      };
    } catch {
      return null;
    }
  }

  private async refreshSession(session: ManagedSessionRecord): Promise<ManagedSessionRecord> {
    const previousStatus = session.status;
    const previousEndedAt = session.endedAt;
    const previousExitCode = session.exitCode;
    const exitState = await this.readExitState(session);
    if (exitState) {
      session.exitCode = exitState.exitCode ?? session.exitCode ?? null;
      session.endedAt = exitState.finishedAt || session.endedAt || new Date().toISOString();
      if (session.status !== 'killed') {
        session.status = (session.exitCode ?? 0) === 0 ? 'completed' : 'failed';
      }
      return session;
    }

    const running = await this.isPidRunning(session.pid);
    if (!running && session.status === 'running') {
      session.endedAt = session.endedAt || new Date().toISOString();
      session.status = session.mode === 'background' ? 'unknown' : 'completed';
    }

    if (
      session.status !== previousStatus
      || session.endedAt !== previousEndedAt
      || session.exitCode !== previousExitCode
    ) {
      await this.persistSession(session);
    }

    return session;
  }

  private async toView(session: ManagedSessionRecord): Promise<ManagedSessionView> {
    await this.refreshSession(session);
    return {
      id: session.id,
      kind: session.kind,
      mode: session.mode,
      title: session.title,
      status: session.status,
      command: session.command,
      targetPath: session.targetPath,
      workingDirectory: session.workingDirectory,
      pid: session.pid,
      visible: session.visible,
      keepOpen: session.keepOpen,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      exitCode: session.exitCode,
      lastError: session.lastError,
      outputAvailable: session.outputAvailable,
      stdoutTail: session.outputAvailable ? await readTextTail(session.stdoutLogPath) : '',
      stderrTail: session.outputAvailable ? await readTextTail(session.stderrLogPath) : '',
      metadata: session.metadata,
    };
  }

  async startBackgroundCommand(options: StartBackgroundCommandOptions): Promise<ManagedSessionView> {
    await this.ensureSessionsLoaded();
    const workingDirectory = options.workingDirectory || os.homedir();
    const session = this.createSessionRecord({
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

    const artifacts = await this.createSessionArtifacts(session.id);
    session.sessionDir = artifacts.sessionDir;
    session.stdoutLogPath = artifacts.stdoutLogPath;
    session.stderrLogPath = artifacts.stderrLogPath;
    session.exitStatePath = artifacts.exitStatePath;
    session.metadataPath = artifacts.metadataPath;

    const outFd = fsSync.openSync(artifacts.stdoutLogPath, 'a');
    const errFd = fsSync.openSync(artifacts.stderrLogPath, 'a');

    try {
      const script = buildBackgroundScript(options.command, workingDirectory, artifacts.exitStatePath);
      const child = spawn('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-EncodedCommand', encodeUtf16Base64(script),
      ], {
        cwd: workingDirectory,
        detached: true,
        stdio: ['ignore', outFd, errFd],
        windowsHide: true,
      });

      session.pid = child.pid;
      this.sessions.set(session.id, session);
      await this.persistSession(session);

      child.once('error', (error) => {
        session.lastError = error.message;
        session.status = 'failed';
        session.endedAt = new Date().toISOString();
        void this.persistSession(session);
      });
      child.once('exit', (code) => {
        if (session.status === 'running') {
          session.exitCode = typeof code === 'number' ? code : null;
          session.endedAt = new Date().toISOString();
          session.status = (session.exitCode ?? 0) === 0 ? 'completed' : 'failed';
          void this.persistSession(session);
        }
      });
      child.unref();
    } finally {
      fsSync.closeSync(outFd);
      fsSync.closeSync(errFd);
    }

    return this.toView(session);
  }

  async startVisibleTerminal(options: StartVisibleTerminalOptions): Promise<ManagedSessionView> {
    await this.ensureSessionsLoaded();
    const workingDirectory = options.workingDirectory || os.homedir();
    const session = this.createSessionRecord({
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

    const artifacts = await this.createSessionArtifacts(session.id);
    session.sessionDir = artifacts.sessionDir;
    session.metadataPath = artifacts.metadataPath;

    const script = buildVisibleTerminalScript(options.command, workingDirectory);
    const args = ['-NoProfile'];
    if (session.keepOpen) {
      args.push('-NoExit');
    }
    args.push('-EncodedCommand', encodeUtf16Base64(script));

    const child = spawn('powershell.exe', args, {
      cwd: workingDirectory,
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    });

    session.pid = child.pid;
    this.sessions.set(session.id, session);
    await this.persistSession(session);

    child.once('error', (error) => {
      session.lastError = error.message;
      session.status = 'failed';
      session.endedAt = new Date().toISOString();
      void this.persistSession(session);
    });
    child.once('exit', (code) => {
      if (session.status === 'running') {
        session.exitCode = typeof code === 'number' ? code : null;
        session.endedAt = new Date().toISOString();
        session.status = session.exitCode !== null && session.exitCode !== 0 ? 'failed' : 'completed';
        void this.persistSession(session);
      }
    });
    child.unref();

    return this.toView(session);
  }

  async launchApplication(options: LaunchApplicationOptions): Promise<ManagedSessionView> {
    await this.ensureSessionsLoaded();
    const title = options.title || `Aplicacion: ${path.basename(options.targetPath)}`;
    const session = this.createSessionRecord({
      kind: 'application',
      mode: 'application',
      title,
      targetPath: options.targetPath,
      workingDirectory: path.dirname(options.targetPath),
      visible: true,
      keepOpen: false,
      outputAvailable: false,
      metadata: options.metadata,
    });

    const artifacts = await this.createSessionArtifacts(session.id);
    session.sessionDir = artifacts.sessionDir;
    session.metadataPath = artifacts.metadataPath;

    if (process.platform === 'win32') {
      const targetEncoded = encodeUtf16Base64([
        `$targetPath = '${escapePowerShellSingleQuoted(options.targetPath)}'`,
        '$proc = Start-Process -FilePath $targetPath -PassThru -ErrorAction Stop',
        '$payload = @{ pid = $proc.Id; processName = $proc.ProcessName } | ConvertTo-Json -Compress',
        '[Console]::Out.WriteLine($payload)',
      ].join('\n'));

      try {
        const { stdout } = await execFileAsync('powershell.exe', [
          '-NoProfile',
          '-EncodedCommand',
          targetEncoded,
        ], {
          timeout: 10000,
          windowsHide: true,
          maxBuffer: 1024 * 128,
        });

        try {
          const parsed = JSON.parse(String(stdout || '{}').trim() || '{}');
          if (typeof parsed?.pid === 'number') {
            session.pid = parsed.pid;
          }
        } catch {
          // If stdout is empty or not JSON, keep session without pid.
        }
      } catch (error: any) {
        session.status = 'failed';
        session.lastError = error?.stderr?.trim() || error?.stdout?.trim() || error?.message || 'No se pudo abrir la aplicacion.';
        session.endedAt = new Date().toISOString();
        this.sessions.set(session.id, session);
        await this.persistSession(session);
        return this.toView(session);
      }
    } else {
      const openResult = await shell.openPath(options.targetPath);
      if (openResult) {
        session.status = 'failed';
        session.lastError = openResult;
        session.endedAt = new Date().toISOString();
      }
    }

    this.sessions.set(session.id, session);
    await this.persistSession(session);
    return this.toView(session);
  }

  async listSessions(): Promise<ManagedSessionView[]> {
    await this.ensureSessionsLoaded();
    const sessions = Array.from(this.sessions.values())
      .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
    const views: ManagedSessionView[] = [];
    for (const session of sessions) {
      views.push(await this.toView(session));
    }
    return views;
  }

  async getSession(sessionId: string): Promise<ManagedSessionView | null> {
    await this.ensureSessionsLoaded();
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }
    return this.toView(session);
  }

  async killSession(sessionId: string): Promise<ManagedSessionView | null> {
    await this.ensureSessionsLoaded();
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    await this.refreshSession(session);
    if (!session.pid || session.status !== 'running') {
      return this.toView(session);
    }

    try {
      if (process.platform === 'win32') {
        await execFileAsync('taskkill.exe', ['/PID', String(session.pid), '/T', '/F'], {
          timeout: 10000,
          windowsHide: true,
          maxBuffer: 1024 * 128,
        });
      } else {
        process.kill(session.pid, 'SIGTERM');
      }
      session.status = 'killed';
      session.endedAt = new Date().toISOString();
      await this.persistSession(session);
    } catch (error: any) {
      session.lastError = error?.stderr?.trim() || error?.stdout?.trim() || error?.message || 'No se pudo terminar la sesion.';
      await this.persistSession(session);
    }

    return this.toView(session);
  }
}

export const backgroundProcessService = new BackgroundProcessService();
