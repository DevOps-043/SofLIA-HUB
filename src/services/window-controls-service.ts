export const windowControlsService = {
  minimize: async (): Promise<void> => {
    try {
      if ((window as any).windowControls?.minimize) {
        await (window as any).windowControls.minimize();
      }
    } catch (e) {
      console.error('Error minimizing window:', e);
    }
  },
  maximize: async (): Promise<void> => {
    try {
      if ((window as any).windowControls?.maximize) {
        await (window as any).windowControls.maximize();
      }
    } catch (e) {
      console.error('Error maximizing window:', e);
    }
  },
  close: async (): Promise<void> => {
    try {
      if ((window as any).windowControls?.close) {
        await (window as any).windowControls.close();
      }
    } catch (e) {
      console.error('Error closing window:', e);
    }
  },
  isMaximized: async (): Promise<boolean> => {
    try {
      if ((window as any).windowControls?.isMaximized) {
        return await (window as any).windowControls.isMaximized();
      }
    } catch (e) {
      console.error('Error checking maximize status:', e);
    }
    return false;
  },
  getPlatform: async (): Promise<string> => {
    try {
      if ((window as any).windowControls?.getPlatform) {
        return await (window as any).windowControls.getPlatform();
      }
    } catch (e) {
      console.error('Error getting platform:', e);
    }
    return typeof navigator !== 'undefined' && navigator.userAgent.includes('Mac') ? 'darwin' : 'win32';
  },
};
