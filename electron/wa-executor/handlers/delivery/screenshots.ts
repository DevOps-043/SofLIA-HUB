import { app, desktopCapturer } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { ToolExecutorContext } from '../../types';

const SCREENSHOT_CLEANUP_DELAY_MS = 5000;

export async function captureAndSendScreenshots(
  toolArgs: Record<string, any>,
  ctx: ToolExecutorContext,
  jid: string,
): Promise<{ sent: number; total: number }> {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 1920, height: 1080 },
  });
  if (sources.length === 0) throw new Error('No se encontraron monitores');

  const monitorIndex = toolArgs.monitor_index;
  const screensToCapture = monitorIndex !== undefined && monitorIndex !== null
    ? [sources[monitorIndex] || sources[0]]
    : sources;

  for (let i = 0; i < screensToCapture.length; i += 1) {
    const source = screensToCapture[i];
    const tmpPath = path.join(app.getPath('temp'), `soflia_screenshot_${Date.now()}_monitor${i}.png`);
    const screenshotBase64 = source.thumbnail.toDataURL().replace(/^data:image\/png;base64,/, '');
    await fs.writeFile(tmpPath, Buffer.from(screenshotBase64, 'base64'));
    await ctx.waService.sendFile(jid, tmpPath, getScreenshotLabel(sources.length, i, source.name));
    setTimeout(() => fs.unlink(tmpPath).catch(() => {}), SCREENSHOT_CLEANUP_DELAY_MS);
  }

  return { sent: screensToCapture.length, total: sources.length };
}

function getScreenshotLabel(totalSources: number, index: number, sourceName: string): string {
  return totalSources > 1 ? `Monitor ${index + 1} de ${totalSources}: ${sourceName}` : 'Captura de pantalla';
}
