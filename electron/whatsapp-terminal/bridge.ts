import path from 'node:path';
import { handleFsCommand } from './fs-handler';
import { parseTerminalCommand } from './parser';
import { handleShellCommand } from './shell-handler';
import { handleSysCommand } from './system-handler';

export class WhatsAppTerminalBridge {
  private workspaceDir: string;

  constructor(workspaceDir: string = process.cwd()) {
    this.workspaceDir = path.resolve(workspaceDir);
  }

  public parseCommand(message: string): string[] {
    return parseTerminalCommand(message);
  }

  public async execute(message: string): Promise<string> {
    try {
      const args = this.parseCommand(message);
      if (args.length === 0) return 'No command provided.';

      const rootCommand = args[0];
      if (rootCommand === '/sys') {
        return await handleSysCommand(args);
      }
      if (rootCommand === '/fs') {
        return await handleFsCommand(args, this.workspaceDir);
      }
      if (rootCommand === '/shell') {
        return await handleShellCommand(args, this.workspaceDir);
      }

      return `Unrecognized root command: ${rootCommand}\nAvailable commands: /sys, /fs, /shell`;
    } catch (error: any) {
      return `[FATAL ERROR]: ${error.message || String(error)}`;
    }
  }
}
