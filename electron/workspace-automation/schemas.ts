/**
 * Schemas JSON para validar las respuestas de Gemini en cada template.
 *
 * Cada template envía un prompt al LLM y espera un JSON con estructura
 * específica. Estos schemas son el contrato de respuesta esperada — el
 * `LlmTaskService` valida que la respuesta del modelo cumpla el schema
 * antes de devolverla al template.
 *
 * `additionalProperties: false` se usa intencionalmente para que el modelo
 * no agregue campos no contemplados (lo cual rompería los handlers que
 * después leen el JSON).
 */

import type { LlmTaskSchema } from '../llm-task-service';

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
        enum: [
          'desktop_task',
          'gchat_message',
          'gmail_reply',
          'gmail_send',
          'calendar_event',
          'gmail_labels',
          'drive_folder_tree',
        ],
      },
    },
  },
};

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
            enum: [
              'desktop_task',
              'gchat_message',
              'gmail_reply',
              'gmail_send',
              'calendar_event',
              'gmail_labels',
              'drive_folder_tree',
            ],
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
