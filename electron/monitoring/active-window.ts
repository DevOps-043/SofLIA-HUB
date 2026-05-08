let activeWinModule: any = null;

export async function getActiveWindowInfo(): Promise<{ title: string; process: string; url?: string } | null> {
  try {
    if (!activeWinModule) activeWinModule = await import('active-win');
    const win = await activeWinModule.default();
    if (!win) return null;
    return {
      title: win.title || 'Unknown',
      process: win.owner?.name || 'Unknown',
      url: win.url || undefined,
    };
  } catch (err: any) {
    console.error('[MonitoringService] active-win error:', err.message);
    return null;
  }
}
