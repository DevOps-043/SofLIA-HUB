export interface OSAutomation {
  getActiveWindow(): Promise<{ title: string; process: string; url?: string }>;
  getIdleTime(): Promise<number>; // in seconds
}
