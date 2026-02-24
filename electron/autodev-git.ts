/**
 * AutoDevGit — Git/GitHub wrapper with safety guards.
 * All write operations verify we are NOT on main/master.
 * Uses execFile (not exec) to prevent shell injection.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const PROTECTED_BRANCHES = ['main', 'master'];

export class AutoDevGit {
  private repoPath: string;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
  }

  async init(taskId: string): Promise<void> {
    const branch = await this.getCurrentBranch();
    if (PROTECTED_BRANCHES.includes(branch)) {
      const branchName = `autodev-task-${taskId}`;
      await this.git('checkout', '-b', branchName);
      console.log(`[AutoDevGit] SAFETY: Auto-switched to work branch ${branchName} from protected branch ${branch}`);
    }
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

  async getBranchHistory(): Promise<string[]> {
    try {
      const output = await this.git('branch', '--sort=-committerdate');
      return output
        .split('\n')
        .map(line => line.trim().replace(/^\*\s+/, ''))
        .filter(line => line.length > 0)
        .slice(0, 5);
    } catch (err: any) {
      console.warn(`[AutoDevGit] getBranchHistory warning: ${err.message}`);
      return [];
    }
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
      const stat = await this.git('diff', '--cached', '--shortstat', '--', '.', ':!package-lock.json', ':!yarn.lock');
      // Output like: " 5 files changed, 120 insertions(+), 30 deletions(-)"
      const insertionsMatch = stat.match(/(\d+) insertion/);
      const deletionsMatch = stat.match(/(\d+) deletion/);
      const insertions = insertionsMatch ? parseInt(insertionsMatch[1], 10) : 0;
      const deletions = deletionsMatch ? parseInt(deletionsMatch[1], 10) : 0;
      return insertions + deletions;
    } catch {
      return 0;
    }
  }

  async hasUncommittedChanges(): Promise<boolean> {
    const status = await this.git('status', '--porcelain');
    return status.length > 0;
  }

  async fetchPRHistory(): Promise<Array<{ number: number; title: string; state: string; url: string }>> {
    try {
      const output = await this.run('gh', ['pr', 'list', '--state', 'all', '--json', 'number,title,state,url']);
      return JSON.parse(output);
    } catch (err: any) {
      console.warn(`[AutoDevGit] fetchPRHistory warning: ${err.message}`);
      return [];
    }
  }

  // ─── Write operations (all guarded) ──────────────────────────────

  async createWorkBranch(name: string, baseBranch: string = 'main'): Promise<string> {
    let branchName = name.startsWith('autodev/') ? name : `autodev/${name}`;

    // First ensure we're on the base branch
    const current = await this.getCurrentBranch();
    if (current !== baseBranch) {
      await this.git('checkout', baseBranch);
    }

    // Pull latest from base branch
    try {
      await this.git('pull', 'origin', baseBranch, '--ff-only');
    } catch {
      // Pull may fail if no remote or changes exist, that's ok
    }

    // Delete branch if it already exists (to avoid checkout -b failure)
    try {
      await this.git('branch', '-D', branchName);
    } catch {
      // Branch didn't exist, ignore
    }

    // Create and switch to work branch
    try {
      await this.git('checkout', '-b', branchName);
    } catch (error: any) {
      if (error?.message?.includes('already exists')) {
        branchName = `${branchName}-${Date.now()}`;
        await this.git('checkout', '-b', branchName);
      } else {
        throw error;
      }
    }
    
    console.log(`[AutoDevGit] Created branch: ${branchName} from ${baseBranch}`);
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
}
