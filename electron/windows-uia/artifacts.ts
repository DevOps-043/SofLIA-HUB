import { app as electronApp } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { WindowsUIAArtifacts } from './types';

export function createArtifacts(task: string): WindowsUIAArtifacts {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeTask = task.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'task';
  const runDirectory = path.join(getArtifactsBaseDir(), `${stamp}-${safeTask}`);
  fs.mkdirSync(runDirectory, { recursive: true });
  const tracePath = path.join(runDirectory, 'trace.jsonl');
  fs.writeFileSync(tracePath, '', 'utf-8');
  return {
    taskId: `uia-${Date.now().toString(36)}`,
    runDirectory,
    reportPath: path.join(runDirectory, 'report.json'),
    tracePath,
    finalScreenshotPath: path.join(runDirectory, 'final.png'),
  };
}

function getArtifactsBaseDir(): string {
  try {
    return path.join(electronApp.getPath('userData'), 'computer-use', 'windows-uia');
  } catch {
    return path.join(process.cwd(), 'computer-use-artifacts', 'windows-uia');
  }
}
