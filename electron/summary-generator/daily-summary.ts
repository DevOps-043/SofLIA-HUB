import { GoogleGenerativeAI } from '@google/generative-ai';
import { SUMMARY_MODEL } from './constants';
import { buildDailySummaryPrompt } from './prompts';
import { buildFallbackSummary, parseSummaryResponse } from './response';
import { buildSummaryStats } from './stats';
import type { ActivityLogEntry, GeneratedSummary, SessionInfo } from './types';

export async function generateDailySummary(
  apiKey: string,
  activities: ActivityLogEntry[],
  sessionInfo: SessionInfo,
  irisProjects?: string[],
): Promise<GeneratedSummary> {
  if (activities.length === 0) {
    return {
      summaryText: 'No se registro actividad durante esta sesion.',
      topApps: [],
      productiveTimeSeconds: 0,
      idleTimeSeconds: 0,
      totalTimeSeconds: 0,
      projectsDetected: [],
      difficulties: [],
      highlights: [],
    };
  }

  const stats = buildSummaryStats(activities);
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: SUMMARY_MODEL });
    const result = await model.generateContent(buildDailySummaryPrompt(sessionInfo, stats, irisProjects));
    return parseSummaryResponse(result.response.text().trim(), stats);
  } catch (err: any) {
    console.error('[SummaryGenerator] Gemini error:', err.message);
    return buildFallbackSummary(stats);
  }
}
