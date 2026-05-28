import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildDailyBriefingPrompt, buildFallbackBriefing } from './prompt';
import type { DailyBriefingSystemData } from './types';

export async function generateBriefingSummary(
  apiKey: string,
  systemData: DailyBriefingSystemData,
): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });
  const prompt = buildDailyBriefingPrompt(systemData);
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (err: any) {
      console.error(`[DailyBriefing] Error con Gemini (intento ${attempt}):`, err.message);
      if (attempt >= maxAttempts) return buildFallbackBriefing(systemData);
      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }

  return buildFallbackBriefing(systemData);
}
