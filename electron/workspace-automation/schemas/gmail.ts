import type { LlmTaskSchema } from '../../llm-task-service';

export const GMAIL_TRIAGE_SCHEMA: LlmTaskSchema = {
  type: 'object',
  required: ['decision', 'summary', 'rationale', 'labelsToAdd', 'archive', 'confidence'],
  additionalProperties: false,
  properties: {
    decision: {
      type: 'string',
      enum: ['reply', 'label_only', 'schedule', 'notify_chat', 'ignore'],
    },
    summary: { type: 'string' },
    rationale: { type: 'string' },
    labelsToAdd: { type: 'array', items: { type: 'string' } },
    archive: { type: 'boolean' },
    confidence: { type: 'number' },
    reply: {
      type: 'object',
      required: ['subject', 'body'],
      additionalProperties: false,
      properties: {
        subject: { type: 'string' },
        body: { type: 'string' },
      },
    },
    calendarEvent: {
      type: 'object',
      required: ['title', 'startIso', 'endIso', 'description'],
      additionalProperties: false,
      properties: {
        title: { type: 'string' },
        startIso: { type: 'string' },
        endIso: { type: 'string' },
        description: { type: 'string' },
        location: { type: 'string' },
      },
    },
    chatNotification: {
      type: 'object',
      required: ['text'],
      additionalProperties: false,
      properties: {
        text: { type: 'string' },
      },
    },
  },
};

export const GMAIL_FOLLOWUP_SCHEMA: LlmTaskSchema = {
  type: 'object',
  required: ['summary', 'subject', 'body', 'confidence'],
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    subject: { type: 'string' },
    body: { type: 'string' },
    confidence: { type: 'number' },
  },
};
