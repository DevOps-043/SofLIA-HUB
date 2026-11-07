import { generateSessionText } from '../ai-provider/text';
import { buildCategorizationPrompt } from './prompts';
import { cleanJsonResponse } from './response';

export async function categorizeActivities(
  processNames: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(processNames)];
  const result = new Map<string, string>();
  if (unique.length === 0) return result;

  try {
    const response = await generateSessionText(buildCategorizationPrompt(unique), { json: true });
    const parsed = JSON.parse(cleanJsonResponse(response.trim()));

    for (const [app, category] of Object.entries(parsed)) {
      result.set(app, category as string);
    }
  } catch {
    console.warn('[SummaryGenerator] No se pudieron categorizar las actividades.');
    for (const name of unique) {
      result.set(name, 'uncategorized');
    }
  }

  return result;
}
