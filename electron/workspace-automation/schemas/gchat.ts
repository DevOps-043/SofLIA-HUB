import type { LlmTaskSchema } from '../../llm-task-service';

export const GCHAT_EXECUTIVE_UPDATE_SCHEMA: LlmTaskSchema = {
  type: 'object',
  required: ['summary', 'message', 'confidence'],
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    message: { type: 'string' },
    confidence: { type: 'number' },
  },
};
