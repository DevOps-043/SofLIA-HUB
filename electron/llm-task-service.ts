import { GoogleGenerativeAI } from '@google/generative-ai';
import { SOFLIA_RUNTIME_MODEL } from '../src/shared/soflia-runtime-model';
import { composeJsonTaskPrompt } from './llm-task/prompt';
import { parseJsonResponse } from './llm-task/json-parser';
import { validateSchema } from './llm-task/schema-validator';
import type { LlmJsonTaskInput, LlmJsonTaskResult } from './llm-task/types';

export type {
  LlmJsonTaskInput,
  LlmJsonTaskResult,
  LlmTaskSchema,
} from './llm-task/types';

const DEFAULT_MODEL = SOFLIA_RUNTIME_MODEL;

export class LlmTaskService {
  private apiKey: string | null = null;
  private genAI: GoogleGenerativeAI | null = null;

  setApiKey(apiKey: string | null): void {
    const normalized = apiKey?.trim() || null;
    if (normalized === this.apiKey) return;
    this.apiKey = normalized;
    this.genAI = null;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async runJsonTask<T = unknown>(task: LlmJsonTaskInput): Promise<LlmJsonTaskResult<T>> {
    const model = this.getClient().getGenerativeModel({
      model: task.model || DEFAULT_MODEL,
      generationConfig: { responseMimeType: 'application/json' },
    });

    const result = await model.generateContent(composeJsonTaskPrompt(task));
    const rawText = result.response.text().trim();
    const parsed = parseJsonResponse(rawText);
    const validationErrors = validateSchema(parsed, task.schema, '$');

    if (validationErrors.length > 0) {
      throw new Error(`La respuesta JSON no cumple el schema: ${validationErrors.join(' | ')}`);
    }

    return { output: parsed as T, rawText };
  }

  private getClient(): GoogleGenerativeAI {
    if (!this.apiKey) throw new Error('No hay API key configurada para llm-task.');
    if (!this.genAI) this.genAI = new GoogleGenerativeAI(this.apiKey);
    return this.genAI;
  }
}
