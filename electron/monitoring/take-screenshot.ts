import path from 'node:path';
import fs from 'node:fs/promises';
import type { desktopCapturer } from 'electron';
import { composeMonitorBuffers, renderMarkedScreenBuffer } from './screenshot-processing';
import { validateScreenshotSafety } from './screenshot-guardrail';
import type { MonitoringDiagnostics } from './types';

interface TakeMonitoringScreenshotOptions {
  desktopCapturerApi: typeof desktopCapturer;
  diagnostics: MonitoringDiagnostics;
  displayId?: string;
  emitError: (message: string) => void;
  screenshotDir: string;
  sharp: any;
  timestamp: Date;
}

export async function takeMonitoringScreenshot(options: TakeMonitoringScreenshotOptions): Promise<string | undefined> {
  const { desktopCapturerApi, diagnostics, displayId, emitError, screenshotDir, sharp, timestamp } = options;
  if (!sharp) {
    if (diagnostics.screenshotFailCount === 0) {
      console.warn('[MonitoringService] sharp not loaded — capturas de pantalla deshabilitadas. Ejecuta: npm rebuild sharp');
      emitError('Modulo sharp no disponible — capturas de pantalla deshabilitadas. Ejecuta npm rebuild sharp para solucionar.');
    }
    diagnostics.screenshotFailCount++;
    return undefined;
  }

  try {
    const sources = await desktopCapturerApi.getSources({ types: ['screen'], thumbnailSize: { width: 1280, height: 720 } });
    if (sources.length === 0) return undefined;

    let targetSources = sources;
    if (displayId) {
      const found = sources.find((source) => source.display_id === displayId || source.id === displayId);
      targetSources = found ? [found] : [sources[0]];
    }

    const processedBuffers: Buffer[] = [];
    for (const source of targetSources) {
      const markedBuffer = await renderMarkedScreenBuffer(sharp, source.thumbnail);
      if (markedBuffer) processedBuffers.push(markedBuffer);
    }

    const finalBuffer = await composeMonitorBuffers(sharp, processedBuffers);
    if (!finalBuffer) return undefined;
    if (!(await validateScreenshotSafety(finalBuffer))) {
      throw new Error('Screenshot discarded due to security guardrail (Indirect Prompt Injection).');
    }

    const safeId = displayId ? displayId.replace(/[^a-zA-Z0-9]/g, '') : 'combined';
    const filePath = path.join(screenshotDir, `snap_${timestamp.getTime()}_${safeId}.png`);
    await fs.writeFile(filePath, finalBuffer);
    return filePath;
  } catch (error: any) {
    console.error('[MonitoringService] Screenshot error:', error.message);
    return undefined;
  }
}
