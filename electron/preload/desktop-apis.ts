import type {
  PreloadBridge,
  SafeIpc,
} from './types';

export function exposeDesktopApi(bridge: PreloadBridge, ipc: SafeIpc): void {
  const { safeInvoke } = ipc;
  bridge.exposeInMainWorld('desktopAgent', {
    executeTask: (task: string, options?: any) => safeInvoke('desktop-agent:execute-task', task, options),
    executeParallel: (tasks: Array<{ task: string; maxSteps?: number; backend?: 'auto' | 'browser' | 'desktop' | 'uia'; startUrl?: string }>) =>
      safeInvoke('desktop-agent:execute-parallel', tasks),
    getActiveTasks: () => safeInvoke('desktop-agent:get-active-tasks'),
    abortTask: (taskId: string) => safeInvoke('desktop-agent:abort-task', taskId),
    abort: () => safeInvoke('desktop-agent:abort'),
    getStatus: () => safeInvoke('desktop-agent:get-status'),
    getConfig: () => safeInvoke('desktop-agent:get-config'),
    listBrowserProfiles: () => safeInvoke('desktop-agent:list-browser-profiles'),
    resetBrowserProfile: (profileId: string) => safeInvoke('desktop-agent:reset-browser-profile', profileId),
    setConfig: (updates: any) => safeInvoke('desktop-agent:set-config', updates),
    startObservation: (objective: string, rules?: string) =>
      safeInvoke('desktop-agent:start-observation', objective, rules),
    stopObservation: () => safeInvoke('desktop-agent:stop-observation'),
    click: (x: number, y: number) => safeInvoke('desktop-agent:click', x, y),
    doubleClick: (x: number, y: number) => safeInvoke('desktop-agent:double-click', x, y),
    rightClick: (x: number, y: number) => safeInvoke('desktop-agent:right-click', x, y),
    drag: (x1: number, y1: number, x2: number, y2: number) =>
      safeInvoke('desktop-agent:drag', x1, y1, x2, y2),
    type: (text: string) => safeInvoke('desktop-agent:type', text),
    key: (key: string) => safeInvoke('desktop-agent:key', key),
    scroll: (direction: string, amount?: number) => safeInvoke('desktop-agent:scroll', direction, amount),
    focusWindow: (title: string) => safeInvoke('desktop-agent:focus-window', title),
    listWindows: () => safeInvoke('desktop-agent:list-windows'),
    takeScreenshot: (fullRes?: boolean) => safeInvoke('desktop-agent:take-screenshot', fullRes),
  });
}
