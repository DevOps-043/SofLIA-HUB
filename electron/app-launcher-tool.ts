import type { ToolImplementation } from '../src/core/ports/tools/Tool';
import { APP_LAUNCHER_DEFINITION } from './app-launcher/definition';
import { closeApp, launchApp } from './app-launcher/process-control';
import { getRunningApps } from './app-launcher/process-list';

export class AppLauncherTool implements ToolImplementation {
  definition = APP_LAUNCHER_DEFINITION;

  async execute(args: any): Promise<any> {
    const { action, appName } = args;

    try {
      if (action === 'list') return this.getRunningApps();
      if (action === 'launch') {
        if (!appName) return { success: false, error: 'Se requiere "appName" para la accion "launch".' };
        return this.launchApp(appName);
      }
      if (action === 'close') {
        if (!appName) return { success: false, error: 'Se requiere "appName" para la accion "close".' };
        return this.closeApp(appName);
      }
      return { success: false, error: `Accion desconocida: ${action}` };
    } catch (error: any) {
      return { success: false, error: `Excepcion en AppLauncherTool: ${error.message}` };
    }
  }

  async getRunningApps(): Promise<any> {
    return getRunningApps();
  }

  async launchApp(name: string): Promise<any> {
    return launchApp(name);
  }

  async closeApp(name: string): Promise<any> {
    return closeApp(name);
  }
}
