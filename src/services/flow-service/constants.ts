import { MODELS } from '../../config';
import type { FlowActionType, FlowIntent, FlowMode } from './types';

export const FLOW_MODEL = MODELS.PRIMARY;
export const FLOW_TRANSCRIPTION_MODEL = MODELS.TRANSCRIPTION || FLOW_MODEL;

export const VALID_INTENTS: FlowIntent[] = [
  'answer',
  'rewrite',
  'instruction',
  'email',
  'automation',
  'clarify',
];

export const VALID_MODES: FlowMode[] = ['answer', 'draft', 'action'];

export const VALID_ACTIONS: FlowActionType[] = [
  'none',
  'open_application',
  'open_url',
  'send_email',
  'desktop_automation',
  'send_to_chat',
];
