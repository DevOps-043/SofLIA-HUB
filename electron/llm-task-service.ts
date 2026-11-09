import { getSessionOpenAIClient } from './ai-provider/session-client';
import { SOFLIA_DEFAULT_MODEL } from '../src/shared/soflia-runtime-model';
import { composeJsonTaskPrompt } from './llm-task/prompt';
import { parseJsonResponse } from './llm-task/json-parser';
import { validateSchema } from './llm-task/schema-validator';
import type { LlmJsonTaskInput, LlmJsonTaskResult } from './llm-task/types';

export type {
  LlmJsonTaskInput,
  LlmJsonTaskResult,
  LlmTaskSchema,
} from './llm-task/types';

const DEFAULT_MODEL = SOFLIA_DEFAULT_MODEL;

export class LlmTaskService {
  async runJsonTask<T = unknown>(task: LlmJsonTaskInput): Promise<LlmJsonTaskResult<T>> {
    const client = await getSessionOpenAIClient();
    const response = await client.responses.create({
      model: DEFAULT_MODEL, input: composeJsonTaskPrompt(task), store: false,
      max_output_tokens: 8192, reasoning: { effort: 'low' },
      text: { format: { type: 'json_object' } },
    });
    const rawText = response.output_text.trim();
    const parsed = parseJsonResponse(rawText);
    const validationErrors = validateSchema(parsed, task.schema, '$');

    if (validationErrors.length > 0) {
      throw new Error(`La respuesta JSON no cumple el schema: ${validationErrors.join(' | ')}`);
    }

    return { output: parsed as T, rawText };
  }

}
