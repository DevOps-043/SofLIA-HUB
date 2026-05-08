import { spawn } from 'node:child_process';
import os from 'node:os';

type PlatformCommands = Record<string, { command: string; args: string[] }>;

const lockCommands: PlatformCommands = {
  win32: { command: 'rundll32.exe', args: ['user32.dll,LockWorkStation'] },
  darwin: { command: 'pmset', args: ['displaysleepnow'] },
  linux: { command: 'xdg-screensaver', args: ['lock'] },
};

const sleepCommands: PlatformCommands = {
  win32: { command: 'rundll32.exe', args: ['powrprof.dll,SetSuspendState', '0,1,0'] },
  darwin: { command: 'pmset', args: ['sleepnow'] },
  linux: { command: 'systemctl', args: ['suspend'] },
};

const muteCommands: PlatformCommands = {
  win32: {
    command: 'powershell.exe',
    args: ['-NoProfile', '-Command', `(New-Object -ComObject WScript.Shell).SendKeys([char]173)`],
  },
  darwin: { command: 'osascript', args: ['-e', 'set volume with output muted'] },
  linux: { command: 'amixer', args: ['-D', 'pulse', 'sset', 'Master', 'mute'] },
};

export function runLockScreen(): Promise<void> {
  return runPlatformCommand(lockCommands);
}

export function runSleep(): Promise<void> {
  return runPlatformCommand(sleepCommands);
}

export function runMuteVolume(): Promise<void> {
  return runPlatformCommand(muteCommands);
}

function runPlatformCommand(commands: PlatformCommands): Promise<void> {
  const platform = os.platform();
  const fallback = platform === 'win32' || platform === 'darwin' ? platform : 'linux';
  const { command, args } = commands[fallback];

  return new Promise((resolve, reject) => {
    try {
      const child = spawn(command, args, { stdio: 'ignore' });
      child.on('close', () => resolve());
      child.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}
