declare global {
  interface Window {
    computerUse?: {
      listDirectory: (dirPath: string, showHidden?: boolean) => Promise<any>;
      readFile: (filePath: string) => Promise<any>;
      writeFile: (filePath: string, content: string) => Promise<any>;
      createWordDocument: (options: any) => Promise<any>;
      createDirectory: (dirPath: string) => Promise<any>;
      moveItem: (source: string, dest: string) => Promise<any>;
      copyItem: (source: string, dest: string) => Promise<any>;
      deleteItem: (itemPath: string) => Promise<any>;
      getFileInfo: (filePath: string) => Promise<any>;
      searchFiles: (dirPath: string, pattern: string) => Promise<any>;
      executeCommand: (command: string) => Promise<any>;
      openApplication: (target: string) => Promise<any>;
      openUrl: (url: string) => Promise<any>;
      runBackgroundCommand: (options: any) => Promise<any>;
      listProcessSessions: () => Promise<any>;
      pollProcessSession: (sessionId: string) => Promise<any>;
      killProcessSession: (sessionId: string) => Promise<any>;
      getSystemInfo: () => Promise<any>;
      clipboardRead: () => Promise<any>;
      clipboardWrite: (text: string) => Promise<any>;
      takeScreenshot: () => Promise<any>;
      confirmAction: (message: string) => Promise<{ confirmed: boolean }>;
      organizeFiles: (options: any) => Promise<any>;
      batchMoveFiles: (options: any) => Promise<any>;
      listDirectorySummary: (options: any) => Promise<any>;
      undoLastFileOperation: (options?: any) => Promise<any>;
      getEmailConfig: () => Promise<any>;
      configureEmail: (email: string, password: string) => Promise<any>;
      sendEmail: (to: string, subject: string, body: string, attachmentPaths?: string[], isHtml?: boolean) => Promise<any>;
      getSidebarPosition?: () => Promise<'left' | 'right' | 'bottom'>;
      setSidebarPosition?: (position: 'left' | 'right' | 'bottom') => Promise<boolean>;
      getTheme?: () => Promise<'system' | 'light' | 'dark'>;
      setTheme?: (theme: 'system' | 'light' | 'dark') => Promise<boolean>;
    };
    desktopAgent?: {
      executeTask: (task: string, options?: any) => Promise<any>;
      executeParallel: (tasks: Array<{ task: string; maxSteps?: number; backend?: 'auto' | 'browser' | 'desktop' | 'uia'; startUrl?: string }>) => Promise<any>;
      getActiveTasks: () => Promise<any>;
      abortTask: (taskId: string) => Promise<any>;
      abort: () => Promise<any>;
      getStatus: () => Promise<any>;
      getConfig: () => Promise<any>;
      listBrowserProfiles: () => Promise<any>;
      resetBrowserProfile: (profileId: string) => Promise<any>;
      setConfig: (updates: any) => Promise<any>;
      startObservation: (objective: string, rules?: string) => Promise<any>;
      stopObservation: () => Promise<any>;
      click: (x: number, y: number) => Promise<any>;
      doubleClick: (x: number, y: number) => Promise<any>;
      rightClick: (x: number, y: number) => Promise<any>;
      drag: (x1: number, y1: number, x2: number, y2: number) => Promise<any>;
      type: (text: string) => Promise<any>;
      key: (key: string) => Promise<any>;
      scroll: (direction: string, amount?: number) => Promise<any>;
      focusWindow: (title: string) => Promise<any>;
      listWindows: () => Promise<any>;
      takeScreenshot: (fullRes?: boolean) => Promise<any>;
      runCalibration: () => Promise<any>;
    };
    remoteNode?: {
      getHostStatus: () => Promise<any>;
      updateHostConfig: (updates: any) => Promise<any>;
      listNodes: () => Promise<any>;
      registerNode: (node: any) => Promise<any>;
      removeNode: (nodeId: string) => Promise<any>;
      testNode: (nodeId: string) => Promise<any>;
      openApplication: (nodeId: string, args: any) => Promise<any>;
      runBackgroundCommand: (nodeId: string, args: any) => Promise<any>;
      executeTask: (nodeId: string, args: any) => Promise<any>;
      takeScreenshot: (nodeId: string, args?: any) => Promise<any>;
      listProcessSessions: (nodeId: string) => Promise<any>;
      pollProcessSession: (nodeId: string, sessionId: string) => Promise<any>;
      killProcessSession: (nodeId: string, sessionId: string) => Promise<any>;
    };
  }
}

export {};
