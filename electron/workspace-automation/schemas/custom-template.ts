import type { LlmTaskSchema } from '../../llm-task-service';
import { CUSTOM_ACTION_KINDS } from './custom-action-kinds';

export const CUSTOM_TEMPLATE_SCHEMA: LlmTaskSchema = {
  type: 'object',
  required: ['name', 'description', 'goal', 'guidance', 'inputHints', 'capabilities'],
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    description: { type: 'string' },
    goal: { type: 'string' },
    guidance: { type: 'string' },
    inputHints: { type: 'array', items: { type: 'string' } },
    capabilities: {
      type: 'array',
      items: {
        type: 'string',
        enum: CUSTOM_ACTION_KINDS,
      },
    },
  },
};
