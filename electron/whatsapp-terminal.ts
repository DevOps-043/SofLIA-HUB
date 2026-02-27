import { z } from 'zod';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import si from 'systeminformation';

const SysCmdSchema = z.tuple([
  z.literal('/sys'),
  z.enum(['info', 'cpu', 'mem'])
]);

const FsCmdSchema = z.tuple([
  z.literal('/fs'),
  z.enum(['ls', 'move', 'rm']),
  z.string(),
  z.string().optional()
]);

const ShellCmdSchema = z.tuple([
  z.literal('/shell'),
  z.string()
]).rest(z.string());

export class WhatsAppTerminalBridge {
  private allowedShellCommands = [
    'npm', 'npm.cmd', 'git', 'git.exe', 'node', 'node.exe', 
    'ls', 'echo', 'ping', 'whoami', 'yarn', 'yarn.cmd', 
    'pnpm', 'pnpm.cmd', 'python', 'python.exe', 'python3', 'python3.exe', 
    'npx', 'npx.cmd', 'tsc', 'tsc.cmd'
  ];
  private workspaceDir: string;

  constructor(workspaceDir: string = process.cwd()) {
    this.workspaceDir = path.resolve(workspaceDir);
  }

  public parseCommand(message: string): string[] {
    const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
    const args: string[] = [];
    let match;
    
    while ((match = regex.exec(message)) !== null) {
      if (match[1] !== undefined) {
        args.push(match[1]); // Double quotes
      } else if (match[2] !== undefined) {
        args.push(match[2]); // Single quotes
      } else {
        args.push(match[0]); // Unquoted
      }
    }
    
    return args;
  }

  private isSafePath(targetPath: string): boolean {
    const resolvedPath = path.resolve(this.workspaceDir, targetPath);
    return resolvedPath.startsWith(this.workspaceDir);
  }

  private resolvePath(targetPath: string): string {
    return path.resolve(this.workspaceDir, targetPath);
  }

  public async execute(message: string): Promise<string> {
    try {
      const args = this.parseCommand(message);
      if (args.length === 0) return 'No command provided.';

      const rootCommand = args[0];

      if (rootCommand === '/sys') {
        return await this.handleSysCommand(args);
      } else if (rootCommand === '/fs') {
        return await this.handleFsCommand(args);
      } else if (rootCommand === '/shell') {
        return await this.handleShellCommand(args);
      }

      return `Unrecognized root command: ${rootCommand}\nAvailable commands: /sys, /fs, /shell`;
    } catch (error: any) {
      return `[FATAL ERROR]: ${error.message || String(error)}`;
    }
  }

  private async handleSysCommand(args: string[]): Promise<string> {
    const parsed = SysCmdSchema.safeParse(args);
    if (!parsed.success) {
      return `[ERROR] Invalid /sys command.\nUsage: /sys [info|cpu|mem]`;
    }

    const [_, subCmd] = parsed.data;

    try {
      switch (subCmd) {
        case 'info': {
          const osInfo = await si.osInfo();
          const system = await si.system();
          return `[System Info]\nOS: ${osInfo.distro} ${osInfo.release} (${osInfo.platform})\nKernel: ${osInfo.kernel}\nArch: ${osInfo.arch}\nSystem: ${system.manufacturer} ${system.model}\nHostname: ${os.hostname()}`;
        }
        case 'cpu': {
          const cpu = await si.cpu();
          const currentLoad = await si.currentLoad();
          return `[CPU Info]\nModel: ${cpu.manufacturer} ${cpu.brand}\nCores: ${cpu.cores} (${cpu.physicalCores} physical)\nSpeed: ${cpu.speed} GHz\nCurrent Load: ${currentLoad.currentLoad.toFixed(2)}%`;
        }
        case 'mem': {
          const mem = await si.mem();
          const totalGB = (mem.total / 1024 / 1024 / 1024).toFixed(2);
          const usedGB = (mem.active / 1024 / 1024 / 1024).toFixed(2);
          const freeGB = (mem.free / 1024 / 1024 / 1024).toFixed(2);
          return `[Memory Info]\nTotal: ${totalGB} GB\nUsed: ${usedGB} GB\nFree: ${freeGB} GB`;
        }
        default:
          return '[ERROR] Unknown /sys sub-command';
      }
    } catch (error: any) {
      return `[SYS ERROR]: ${error.message}`;
    }
  }

  private async handleFsCommand(args: string[]): Promise<string> {
    const parsed = FsCmdSchema.safeParse(args);
    if (!parsed.success) {
      return `[ERROR] Invalid /fs command.\nUsage:\n- /fs ls <path>\n- /fs rm <path>\n- /fs move <src> <dest>`;
    }

    const [_, action, target, dest] = parsed.data;

    if (!this.isSafePath(target)) {
      return `[SECURITY ERROR]: Path traversal detected for target: ${target}`;
    }

    const resolvedTarget = this.resolvePath(target);

    try {
      switch (action) {
        case 'ls': {
          try {
            const stats = await fs.stat(resolvedTarget);
            if (!stats.isDirectory()) {
              return `[INFO]: ${target} is a file.\nSize: ${stats.size} bytes\nModified: ${stats.mtime.toISOString()}`;
            }
            const items = await fs.readdir(resolvedTarget, { withFileTypes: true });
            if (items.length === 0) return `[Directory is empty]: ${target}`;
            
            const formatted = items.map(item => {
              const type = item.isDirectory() ? '[DIR]' : '[FILE]';
              return `${type} ${item.name}`;
            });
            return `[Contents of ${target}]\n${formatted.join('\n')}`;
          } catch (err: any) {
            if (err.code === 'ENOENT') return `[ERROR]: Directory or file not found: ${target}`;
            throw err;
          }
        }
        case 'rm': {
          try {
            const stats = await fs.stat(resolvedTarget);
            if (stats.isDirectory()) {
              await fs.rm(resolvedTarget, { recursive: true, force: true });
            } else {
              await fs.unlink(resolvedTarget);
            }
            return `[SUCCESS]: Removed ${target}`;
          } catch (err: any) {
            if (err.code === 'ENOENT') return `[ERROR]: Target not found: ${target}`;
            throw err;
          }
        }
        case 'move': {
          if (!dest) {
            return `[ERROR]: /fs move requires a destination path.\nUsage: /fs move <src> <dest>`;
          }
          if (!this.isSafePath(dest)) {
            return `[SECURITY ERROR]: Path traversal detected for destination: ${dest}`;
          }
          const resolvedDest = this.resolvePath(dest);
          
          await fs.rename(resolvedTarget, resolvedDest);
          return `[SUCCESS]: Moved ${target} -> ${dest}`;
        }
        default:
          return `[ERROR] Unknown /fs action: ${action}`;
      }
    } catch (error: any) {
      return `[FS ERROR]: ${error.message}`;
    }
  }

  private async handleShellCommand(args: string[]): Promise<string> {
    const parsed = ShellCmdSchema.safeParse(args);
    if (!parsed.success) {
      return `[ERROR] Invalid /shell command.\nUsage: /shell <cmd> [args...]`;
    }

    const cmdArray = parsed.data;
    const baseCmd = cmdArray[1];
    const cmdArgs = cmdArray.slice(2) as string[];

    if (!this.allowedShellCommands.includes(baseCmd)) {
      return `[SECURITY ERROR]: Command '${baseCmd}' is not allowed.\nWhitelist: ${this.allowedShellCommands.join(', ')}`;
    }

    return new Promise((resolve) => {
      let stdoutData = '';
      let stderrData = '';

      try {
        const child = spawn(baseCmd, cmdArgs, {
          cwd: this.workspaceDir,
          shell: false, // Ensures no shell is used, avoiding command injection vulnerabilities
        });

        child.stdout.on('data', (data) => {
          stdoutData += data.toString();
        });

        child.stderr.on('data', (data) => {
          stderrData += data.toString();
        });

        child.on('error', (err) => {
          resolve(`[SPAWN ERROR]: Failed to start process '${baseCmd}'.\n${err.message}`);
        });

        child.on('close', (code) => {
          let output = `[Process Exited] Code: ${code}`;
          if (stdoutData) output += `\n\n[STDOUT]\n${stdoutData.trim()}`;
          if (stderrData) output += `\n\n[STDERR]\n${stderrData.trim()}`;
          resolve(output);
        });
        
        // Timeout to prevent infinite hanging commands (e.g., waiting for user input)
        const timeoutMs = 15000;
        setTimeout(() => {
          if (!child.killed && child.exitCode === null) {
            child.kill('SIGKILL');
            resolve(`[TIMEOUT]: Process killed after ${timeoutMs / 1000}s.\n\n[STDOUT]:\n${stdoutData}\n\n[STDERR]:\n${stderrData}`);
          }
        }, timeoutMs);

      } catch (err: any) {
        resolve(`[FATAL SHELL ERROR]: ${err.message}`);
      }
    });
  }
}
