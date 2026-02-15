import { OSAutomation } from '../../core/ports/OSAutomation';

export class NodeOSAutomation implements OSAutomation {
  async getActiveWindow(): Promise<{ title: string; process: string; url?: string }> {
    try {
      // Dynamic import for 'active-win' stubbed for now due to build issues with native modules in dev
      // const activeWin = (await import('active-win')).default;
      // const result = await activeWin();

      // if (!result) {
      //   return { title: 'Unknown', process: 'Unknown' };
      // }

      return {
        title: 'Stub Window', // result.title,
        process: 'Stub Process', // result.owner.name,
        // url: (result as any).url 
      };
    } catch (error) {
      console.error('Failed to get active window:', error);
      return { title: 'Idle/Unknown', process: 'System' };
    }
  }

  async getIdleTime(): Promise<number> {
    // Placeholder: implementation would require 'desktop-idle' or similar
    return 0;
  }
}
