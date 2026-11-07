import { generateSessionText } from '../ai-provider/text';
import { buildDailySummaryPrompt } from './prompts';
import { buildFallbackSummary, parseSummaryResponse } from './response';
import { buildSummaryStats } from './stats';
import type { ActivityLogEntry, GeneratedSummary, SessionInfo } from './types';

export async function generateDailySummary(
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
    const result = await generateSessionText(buildDailySummaryPrompt(sessionInfo, stats, irisProjects), { json: true });
    return parseSummaryResponse(result.trim(), stats);
  } catch {
    console.warn('[SummaryGenerator] Se utilizó el resumen local.');
    return buildFallbackSummary(stats);
  }
}
