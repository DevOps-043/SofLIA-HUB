import type { LlmTaskSchema } from '../../llm-task-service';
import { CUSTOM_ACTION_KINDS } from './custom-action-kinds';

export const CUSTOM_EXECUTION_SCHEMA: LlmTaskSchema = {
  type: 'object',
  required: ['summary', 'rationale', 'steps', 'missingData', 'confidence', 'needsApproval', 'actions'],
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    rationale: { type: 'string' },
    steps: { type: 'array', items: { type: 'string' } },
    missingData: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'number' },
    needsApproval: { type: 'boolean' },
    actions: {
      type: 'array',
      items: {
        type: 'object',
        required: ['kind', 'title', 'payload'],
        additionalProperties: false,
        properties: {
          kind: {
            type: 'string',
            enum: CUSTOM_ACTION_KINDS,
          },
          title: { type: 'string' },
          payload: {
            type: 'object',
            properties: {},
          },
        },
      },
    },
  },
};
