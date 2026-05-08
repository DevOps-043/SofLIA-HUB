import { detectPromptInjection } from '../security/prompt-injection-detector';

export async function validateScreenshotSafety(imageBuffer: Buffer): Promise<boolean> {
  try {
    const { extractTextFromBase64 } = await import('../ocr-service');
    const text = await extractTextFromBase64(imageBuffer.toString('base64'));
    if (!text) return true;

    const detection = detectPromptInjection(text);
    if (detection.detected) {
      console.warn(
        `[MonitoringService] OCR Guardrail: suspicious prompt injection detected (${detection.reasons.join(', ')}).`,
      );
      return false;
    }
    return true;
  } catch (err: any) {
    console.error('[MonitoringService] validateScreenshotSafety error:', err.message);
    return true;
  }
}
