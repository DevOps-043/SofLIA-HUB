import { generateSessionText } from '../ai-provider/text';
import { buildDailyBriefingPrompt, buildFallbackBriefing } from './prompt';
import type { DailyBriefingSystemData } from './types';

export async function generateBriefingSummary(systemData: DailyBriefingSystemData, signal: AbortSignal): Promise<string> {
  try {
    return (await generateSessionText(buildDailyBriefingPrompt(systemData), { signal })).trim() || buildFallbackBriefing(systemData);
  } catch {
    signal.throwIfAborted();
    return buildFallbackBriefing(systemData);
  }
}
