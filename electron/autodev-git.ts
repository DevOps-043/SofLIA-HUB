/**
 * AutoDevGit — Git/GitHub wrapper with safety guards.
 * All write operations verify we are NOT on main/master.
 * Uses execFile (not exec) to prevent shell injection.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFile, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const execFileAsync = promisify(execFile);

const PROTECTED_BRANCHES = ['main', 'master'];

export class AutoDevGit {
  private repoPath: string;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
  }

  private async run(cmd: string, args: string[]): Promise<string> {
    const { stdout } = await execFileAsync(cmd, args, {
      cwd: this.repoPath,
      maxBuffer: 10 * 1024 * 1024,
      timeout: 60_000,
    });
    return stdout.trim();
  }

  private async git(...args: string[]): Promise<string> {
    return this.run('git', args);
  }

  private async assertNotProtected(): Promise<void> {
    const branch = await this.getCurrentBranch();
    if (PROTECTED_BRANCHES.includes(branch)) {
      throw new Error(`[AutoDevGit] SAFETY: Refusing write operation on protected branch "${branch}"`);
    }
  }

  // ─── Read-only operations ────────────────────────────────────────

  async getCurrentBranch(): Promise<string> {
    return this.git('rev-parse', '--abbrev-ref', 'HEAD');
  }

  async getRepoRoot(): Promise<string> {
    return this.git('rev-parse', '--show-toplevel');
  }

  async getDiff(): Promise<string> {
    return this.git('diff', '--cached', '--stat');
  }

  async getFullDiff(): Promise<string> {
    return this.git('diff', '--cached');
  }

  async getDiffLineCount(): Promise<number> {
    try {
      const stat = await this.git('diff', '--cached', '--shortstat');
      // Output like: "5 files changed, 120 insertions(+), 30 deletions(-)"
      const insertions = parseInt(stat.match(/(\d+) insertion/)?.[1] || '0', 10);
      const deletions = parseInt(stat.match(/(\d+) deletion/)?.[1] || '0', 10);
      return insertions + deletions;
    } catch {
      return 0;
    }
  }

  async hasUncommittedChanges(): Promise<boolean> {
    const status = await this.git('status', '--porcelain');
    return status.length > 0;
  }

  // ─── Write operations (all guarded) ──────────────────────────────

  async createWorkBranch(name: string): Promise<string> {
    const branchName = name.startsWith('autodev/') ? name : `autodev/${name}`;

    // First ensure we're on the target branch
    const current = await this.getCurrentBranch();
    if (!PROTECTED_BRANCHES.includes(current)) {
      // If we're on some other branch, go to main first
      await this.git('checkout', 'main');
    }

    // Pull latest
    try {
      await this.git('pull', '--ff-only');
    } catch {
      // Pull may fail if no remote, that's ok
    }

    // Create and switch to work branch
    await this.git('checkout', '-b', branchName);
    console.log(`[AutoDevGit] Created branch: ${branchName}`);
    return branchName;
  }

  async stageFiles(files: string[]): Promise<void> {
    await this.assertNotProtected();
    if (files.length === 0) return;
    await this.git('add', ...files);
  }

  async stageAll(): Promise<void> {
    await this.assertNotProtected();
    await this.git('add', '-A');
  }

  async commitChanges(message: string): Promise<string> {
    await this.assertNotProtected();
    const fullMessage = message.startsWith('[AutoDev]') ? message : `[AutoDev] ${message}`;
    await this.git('commit', '-m', fullMessage);
    const hash = await this.git('rev-parse', '--short', 'HEAD');
    console.log(`[AutoDevGit] Committed: ${hash} - ${fullMessage}`);
    return hash;
  }

  async pushBranch(branchName: string): Promise<void> {
    if (PROTECTED_BRANCHES.includes(branchName)) {
      throw new Error(`[AutoDevGit] SAFETY: Refusing to push to protected branch "${branchName}"`);
    }
    await this.git('push', '-u', 'origin', branchName);
    console.log(`[AutoDevGit] Pushed: ${branchName}`);
  }

  async createPR(title: string, body: string, baseBranch: string): Promise<string> {
    const prTitle = title.startsWith('[AutoDev]') ? title : `[AutoDev] ${title}`;
    const result = await this.run('gh', [
      'pr', 'create',
      '--title', prTitle,
      '--body', body,
      '--base', baseBranch,
    ]);
    // gh pr create outputs the PR URL
    const prUrl = result.trim().split('\n').pop() || result.trim();
    console.log(`[AutoDevGit] PR created: ${prUrl}`);
    return prUrl;
  }

  async switchBranch(name: string): Promise<void> {
    await this.git('checkout', name);
    console.log(`[AutoDevGit] Switched to: ${name}`);
  }

  async cleanupBranch(branchName: string): Promise<void> {
    if (PROTECTED_BRANCHES.includes(branchName)) return;

    try {
      const current = await this.getCurrentBranch();
      if (current === branchName) {
        // Discard changes and switch to main
        await this.git('reset', '--hard', 'HEAD');
        await this.git('clean', '-fd');
        await this.git('checkout', 'main');
      }
      await this.git('branch', '-D', branchName);
      console.log(`[AutoDevGit] Cleaned up branch: ${branchName}`);
    } catch (err: any) {
      console.warn(`[AutoDevGit] Cleanup warning: ${err.message}`);
    }
  }

  // ─── Validation ──────────────────────────────────────────────────

  async isGhAuthenticated(): Promise<boolean> {
    try {
      await this.run('gh', ['auth', 'status']);
      return true;
    } catch {
      return false;
    }
  }

  async hasRemote(): Promise<boolean> {
    try {
      const remotes = await this.git('remote', '-v');
      return remotes.includes('origin');
    } catch {
      return false;
    }
  }

  // ─── Sandboxed Execution ─────────────────────────────────────────

  /**
   * Ejecuta un script en un subproceso estricto sin red y con escritura
   * limitada al directorio temporal.
   * Lanza error si el script falla (código de salida != 0).
   */
  async validateScript(scriptContent: string): Promise<void> {
    const tempDir = tmpdir();
    const scriptId = randomUUID();
    const scriptPath = join(tempDir, `autodev-script-${scriptId}.js`);

    await writeFile(scriptPath, scriptContent, 'utf-8');

    try {
      // Ejecutar en subproceso aislado usando Electron como Node
      // Usando el modelo de permisos experimentales de Node 20+
      // Sin la flag --allow-net, el acceso a red está bloqueado.
      await execFileAsync(
        process.execPath,
        [
          '--experimental-permission',
          '--allow-fs-read=*',
          `--allow-fs-write=${tempDir}`,
          scriptPath,
        ],
        {
          cwd: tempDir,
          timeout: 15_000, // Tiempo máximo de ejecución: 15s
          env: {
            ...process.env,
            ELECTRON_RUN_AS_NODE: '1',
          },
        }
      );
      console.log(`[AutoDevGit] Script validation passed.`);
    } catch (err: any) {
      console.error(`[AutoDevGit] Script validation failed:`, err.message);
      throw new Error(`[AutoDevGit] SAFETY: Script validation failed with exit code ${err.code || 'unknown'}`);
    } finally {
      await rm(scriptPath, { force: true }).catch(() => {});
    }
  }

  /**
   * Valida un script generado por la IA y, si es exitoso (código 0),
   * realiza stage de los archivos y ejecuta el commit.
   */
  async validateAndCommit(
    scriptContent: string,
    message: string,
    filesToStage?: string[]
  ): Promise<string> {
    await this.assertNotProtected();

    // 1. Validar el script en el entorno seguro
    await this.validateScript(scriptContent);

    // 2. Realizar git add
    if (filesToStage && filesToStage.length > 0) {
      await this.stageFiles(filesToStage);
    } else {
      await this.stageAll();
    }

    // 3. Realizar git commit
    return this.commitChanges(message);
  }
}
