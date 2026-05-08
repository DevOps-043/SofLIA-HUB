import fs from 'node:fs/promises';

export async function readOcrText(enabled: boolean, screenshotPath: string | undefined): Promise<string | undefined> {
  if (!enabled || !screenshotPath) return undefined;

  try {
    const { extractTextFromFile } = await import('../ocr-service');
    const text = await extractTextFromFile(screenshotPath);
    return text && text.length > 2000 ? text.slice(0, 2000) : text;
  } catch {
    return undefined;
  }
}

export async function readSemanticSnapshot(
  enabled: boolean | undefined,
  isIdle: boolean,
  screenshotPath: string | undefined,
): Promise<string | undefined> {
  if (!enabled || isIdle || !screenshotPath) return undefined;

  try {
    const buffer = await fs.readFile(screenshotPath);
    return buffer.toString('base64');
  } catch (err) {
    console.error('[MonitoringService] Failed to generate semantic snapshot base64:', err);
    return undefined;
  }
}

export function deleteTransientScreenshot(screenshotPath: string | undefined, keepScreenshot: boolean): void {
  if (screenshotPath && !keepScreenshot) {
    fs.unlink(screenshotPath).catch(() => {});
  }
}
