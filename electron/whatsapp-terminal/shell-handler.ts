import { spawn } from 'node:child_process';
import { ShellCmdSchema } from './schemas';

const ALLOWED_SHELL_COMMANDS = [
  'npm', 'npm.cmd', 'git', 'git.exe', 'node', 'node.exe',
  'ls', 'echo', 'ping', 'whoami', 'yarn', 'yarn.cmd',
  'pnpm', 'pnpm.cmd', 'python', 'python.exe', 'python3', 'python3.exe',
  'npx', 'npx.cmd', 'tsc', 'tsc.cmd',
];

const SHELL_TIMEOUT_MS = 15000;

export async function handleShellCommand(args: string[], workspaceDir: string): Promise<string> {
  const parsed = ShellCmdSchema.safeParse(args);
  if (!parsed.success) {
    return `[ERROR] Invalid /shell command.\nUsage: /shell <cmd> [args...]`;
  }

  const cmdArray = parsed.data;
  const baseCmd = cmdArray[1];
  const cmdArgs = cmdArray.slice(2) as string[];
  if (!ALLOWED_SHELL_COMMANDS.includes(baseCmd)) {
    return `[SECURITY ERROR]: Command '${baseCmd}' is not allowed.\nWhitelist: ${ALLOWED_SHELL_COMMANDS.join(', ')}`;
  }

  return new Promise((resolve) => {
    let stdoutData = '';
    let stderrData = '';

    try {
      const child = spawn(baseCmd, cmdArgs, { cwd: workspaceDir, shell: false });
      child.stdout.on('data', (data) => { stdoutData += data.toString(); });
      child.stderr.on('data', (data) => { stderrData += data.toString(); });
      child.on('error', (err) => {
        resolve(`[SPAWN ERROR]: Failed to start process '${baseCmd}'.\n${err.message}`);
      });
      child.on('close', (code) => {
        let output = `[Process Exited] Code: ${code}`;
        if (stdoutData) output += `\n\n[STDOUT]\n${stdoutData.trim()}`;
        if (stderrData) output += `\n\n[STDERR]\n${stderrData.trim()}`;
        resolve(output);
      });
      setTimeout(() => {
        if (!child.killed && child.exitCode === null) {
          child.kill('SIGKILL');
          resolve(`[TIMEOUT]: Process killed after ${SHELL_TIMEOUT_MS / 1000}s.\n\n[STDOUT]:\n${stdoutData}\n\n[STDERR]:\n${stderrData}`);
        }
      }, SHELL_TIMEOUT_MS);
    } catch (err: any) {
      resolve(`[FATAL SHELL ERROR]: ${err.message}`);
    }
  });
}
