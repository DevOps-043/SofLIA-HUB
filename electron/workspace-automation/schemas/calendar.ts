import type { LlmTaskSchema } from '../../llm-task-service';

export const CALENDAR_BRIEF_SCHEMA: LlmTaskSchema = {
  type: 'object',
  required: ['summary', 'keyPoints', 'risks', 'shouldSendChat', 'confidence'],
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    keyPoints: { type: 'array', items: { type: 'string' } },
    risks: { type: 'array', items: { type: 'string' } },
    shouldSendChat: { type: 'boolean' },
    confidence: { type: 'number' },
    chatDraft: { type: 'string' },
  },
};

export const CALENDAR_MEETING_PREP_SCHEMA: LlmTaskSchema = {
  type: 'object',
  required: ['summary', 'talkingPoints', 'risks', 'shouldSendChat', 'confidence'],
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    talkingPoints: { type: 'array', items: { type: 'string' } },
    risks: { type: 'array', items: { type: 'string' } },
    shouldSendChat: { type: 'boolean' },
    chatDraft: { type: 'string' },
    confidence: { type: 'number' },
  },
};
