import { exec } from 'node:child_process';
import { validateCommandSafety } from './command-security';

const COMMAND_TIMEOUT = 30_000;

export function handleExecuteCommand(
  args: Record<string, any>,
  onProgress?: (message: string) => void,
): Promise<Record<string, any>> | Record<string, any> {
  let command: string;
  try {
    command = validateCommandSafety(args.command);
  } catch (err: any) {
    return { success: false, error: err.message };
  }
  onProgress?.(`Ejecutando comando en segundo plano: ${command.substring(0, 50)}${command.length > 50 ? '...' : ''}`);
  return new Promise((resolve) => {
    exec(command, {
      timeout: COMMAND_TIMEOUT,
      maxBuffer: 1024 * 512,
      windowsHide: true,
      shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/bash',
    }, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: error.message, stdout: stdout?.trim() || '', stderr: stderr?.trim() || '', exitCode: error.code });
      } else {
        resolve({ success: true, stdout: stdout?.trim() || '', stderr: stderr?.trim() || '', exitCode: 0 });
      }
    });
  });
}
