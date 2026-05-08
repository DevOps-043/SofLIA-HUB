import * as fs from 'node:fs';
import { WATCH_DEBOUNCE_MS } from './constants';

export function stopPathWatchers(watchers: fs.FSWatcher[]): void {
  for (const watcher of watchers) {
    try {
      watcher.close();
    } catch {}
  }
  watchers.length = 0;
}

export function setupPathWatchers(options: {
  keyPaths: Map<string, string>;
  watchers: fs.FSWatcher[];
  timers: Map<string, NodeJS.Timeout>;
  changedDirs: Set<string>;
  onChanged: () => void;
}): void {
  stopPathWatchers(options.watchers);
  for (const [label, dirPath] of options.keyPaths.entries()) {
    if (label === 'Home' || label === 'OneDrive') continue;
    watchPath(dirPath, options);
  }
}

function watchPath(dirPath: string, options: {
  watchers: fs.FSWatcher[];
  timers: Map<string, NodeJS.Timeout>;
  changedDirs: Set<string>;
  onChanged: () => void;
}): void {
  try {
    const watcher = fs.watch(dirPath, { persistent: false }, () => {
      const existing = options.timers.get(dirPath);
      if (existing) clearTimeout(existing);
      options.timers.set(dirPath, setTimeout(() => {
        options.timers.delete(dirPath);
        options.changedDirs.add(dirPath);
        options.onChanged();
      }, WATCH_DEBOUNCE_MS));
    });
    options.watchers.push(watcher);
  } catch (err: any) {
    console.warn(`[PathMemory] No se pudo monitorear ${dirPath}: ${err.message}`);
  }
}
