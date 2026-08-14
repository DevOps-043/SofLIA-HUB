import { execSync, spawn, type ChildProcess } from 'node:child_process';

type ProcessWithElectronApp = NodeJS.Process & { electronApp?: ChildProcess | null };

type StartElectronDevProcessOptions = {
  /**
   * Origen HTTP real del renderer Vite. El plugin llama `onstart` despues de
   * que Vite eligio puerto, pero esa URL no siempre llega al proceso Electron
   * mediante `process.env`. Pasarla de forma explicita evita que main crea que
   * esta en produccion y sirva el `index.html` construido dentro del iframe.
   */
  devServerUrl?: string;
};

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

export async function startElectronDevProcess(
  argv = ['.', '--no-sandbox'],
  options: StartElectronDevProcessOptions = {},
): Promise<void> {
  const electronModule: unknown = await import('electron');
  const electronPath = typeof electronModule === 'string'
    ? electronModule
    : (electronModule as { default?: string }).default ?? String(electronModule);

  await stopElectronDevProcess();

  const child = spawn(electronPath, argv, {
    stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
    env: {
      ...process.env,
      ...(options.devServerUrl ? { VITE_DEV_SERVER_URL: options.devServerUrl } : {}),
    },
  });

  electronRuntime.electronApp = child;
  child.once('exit', () => {
    if (electronRuntime.electronApp === child) {
      electronRuntime.electronApp = null;
      process.exit();
    }
  });
}
