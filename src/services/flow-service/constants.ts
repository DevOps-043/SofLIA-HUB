import { SOFLIA_DEFAULT_MODEL } from '../../shared/soflia-runtime-model';
import type { FlowActionType, FlowIntent, FlowMode } from './types';

export const FLOW_MODEL = SOFLIA_DEFAULT_MODEL;
export const FLOW_TRANSCRIPTION_MODEL = 'gpt-transcribe';

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
