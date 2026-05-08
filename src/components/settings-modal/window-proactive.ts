export {};

declare global {
  interface Window {
    proactive?: {
      getConfig: () => Promise<any>;
      updateConfig: (updates: any) => Promise<{ success: boolean; error?: string }>;
      triggerNow: (phoneNumber?: string) => Promise<{ success: boolean; message?: string; error?: string }>;
      getStatus: () => Promise<{ running: boolean; config: any }>;
    };
  }
}
