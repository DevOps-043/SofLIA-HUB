import * as fs from 'node:fs';

export function closeToolWatchers(watchers: fs.FSWatcher[]): fs.FSWatcher[] {
  for (const watcher of watchers) watcher.close();
  return [];
}

export function resetToolWatchers(
  currentWatchers: fs.FSWatcher[],
  directories: string[],
  onRefresh: () => Promise<void>,
): fs.FSWatcher[] {
  closeToolWatchers(currentWatchers);

  const watchers: fs.FSWatcher[] = [];
  for (const directory of directories) {
    try {
      const watcher = fs.watch(directory, async () => {
        try {
          await onRefresh();
        } catch (error) {
          console.error(`[MCP] Error refreshing tools for ${directory}:`, error);
        }
      });
      watchers.push(watcher);
      console.log(`[MCP] Watching dynamic tools in: ${directory}`);
    } catch (error) {
      console.error(`[MCP] Error watching dynamic tools directory ${directory}:`, error);
    }
  }

  return watchers;
}
