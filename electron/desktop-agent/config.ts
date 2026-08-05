import fs from 'node:fs';
import path from 'node:path';
import { app as electronApp } from 'electron';
import { SOFLIA_RUNTIME_MODEL } from '../../src/shared/soflia-runtime-model';

import type { DesktopAgentConfig } from './task-types';

export const DEFAULT_CONFIG: DesktopAgentConfig = {
  maxSteps: 200,
  screenshotWidth: 1024,
  screenshotHeight: 768,
  defaultActionDelay: 300,
  waitForChangeTimeout: 8000,
  waitForChangeInterval: 500,
  continuousObservationInterval: 2000,
  planningEnabled: true,
  memoryWindowSize: 10,
  model: SOFLIA_RUNTIME_MODEL,
  fallbackModel: SOFLIA_RUNTIME_MODEL,
  maxConsecutiveFailures: 3,
  stuckDetectionThreshold: 4,
  autoRecoverFromDialogs: true,
  replanOnStuck: true,
  maxRetryPerAction: 2,
  proactiveModel: SOFLIA_RUNTIME_MODEL,
  maxConcurrentAgents: 3,
  gridEnabled: true,
  gridStep: 100,
  zoomEnabled: true,
  zoomResolution: 512,
  verificationEnabled: true,
  maxTotalSteps: 500,
  summarizeEveryNSteps: 15,
  maxRawHistorySteps: 8,
  hierarchicalPlanningEnabled: true,
  progressReportEveryNSteps: 25,
  somEnabled: true,
  somFallbackToGrid: true,
  focusedCaptureEnabled: true,
  focusedCapturePadding: 24,
};

function getConfigPath(): string {
  try {
    return path.join(electronApp.getPath('userData'), 'desktop-agent-config.json');
  } catch {
    return path.join(process.cwd(), 'desktop-agent-config.json');
  }
}

export function loadConfig(): DesktopAgentConfig {
  try {
    const configPath = getConfigPath();
    if (fs.existsSync(configPath)) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(configPath, 'utf-8')) };
    }
  } catch {
    return { ...DEFAULT_CONFIG };
  }
  return { ...DEFAULT_CONFIG };
}

export function saveConfig(config: DesktopAgentConfig): void {
  try {
    fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), 'utf-8');
  } catch (err: any) {
    console.error('[DesktopAgent] Error saving config:', err.message);
  }
}
