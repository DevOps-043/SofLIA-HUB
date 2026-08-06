import { execSync, spawn, type ChildProcess } from 'node:child_process';

type ProcessWithElectronApp = NodeJS.Process & { electronApp?: ChildProcess | null };

const electronRuntime = process as ProcessWithElectronApp;

export async function stopElectronDevProcess(): Promise<void> {
  const child = electronRuntime.electronApp;
  if (!child) return;

  electronRuntime.electronApp = null;
  child.removeAllListeners();

  if (child.exitCode !== null || child.killed) {
    return;
  }

  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    child.once('exit', finish);

    try {
      if (!child.pid) {
        finish();
        return;
      }

      if (process.platform === 'win32') {
        execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' });
      } else {
        child.kill('SIGTERM');
      }
    } catch {
      finish();
    }

    setTimeout(finish, 2000);
  });
}

export async function startElectronDevProcess(argv = ['.', '--no-sandbox']): Promise<void> {
  const electronModule: unknown = await import('electron');
  const electronPath = typeof electronModule === 'string'
    ? electronModule
    : (electronModule as { default?: string }).default ?? String(electronModule);

  await stopElectronDevProcess();

  const child = spawn(electronPath, argv, {
    stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
  });

  electronRuntime.electronApp = child;
  child.once('exit', () => {
    if (electronRuntime.electronApp === child) {
      electronRuntime.electronApp = null;
      process.exit();
    }
  });
}
