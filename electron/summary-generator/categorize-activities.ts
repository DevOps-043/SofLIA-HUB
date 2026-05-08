import { GoogleGenerativeAI } from '@google/generative-ai';
import { SUMMARY_MODEL } from './constants';
import { buildCategorizationPrompt } from './prompts';
import { cleanJsonResponse } from './response';

export async function categorizeActivities(
  apiKey: string,
  processNames: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(processNames)];
  const result = new Map<string, string>();
  if (unique.length === 0) return result;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: SUMMARY_MODEL });
    const response = await model.generateContent(buildCategorizationPrompt(unique));
    const parsed = JSON.parse(cleanJsonResponse(response.response.text().trim()));

    for (const [app, category] of Object.entries(parsed)) {
      result.set(app, category as string);
    }
  } catch (err: any) {
    console.error('[SummaryGenerator] Categorization error:', err.message);
    for (const name of unique) {
      result.set(name, 'uncategorized');
    }
  }

  return result;
}
