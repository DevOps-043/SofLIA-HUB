import type { LlmTaskSchema } from '../../llm-task-service';

export const DESKTOP_ACTION_SCHEMA: LlmTaskSchema = {
  type: 'object',
  required: ['summary', 'rationale', 'task', 'confidence'],
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    rationale: { type: 'string' },
    task: { type: 'string' },
    confidence: { type: 'number' },
  },
};
