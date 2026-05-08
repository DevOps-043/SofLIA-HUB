import type { FlowAction, FlowIntent } from './types';

export function inferIntentFromAction(action: FlowAction | null, transcript: string): FlowIntent {
  if (action?.type === 'send_email') {
    return 'email';
  }

  if (action?.type === 'desktop_automation') {
    return 'automation';
  }

  if (action?.type === 'open_application' || action?.type === 'open_url') {
    return 'instruction';
  }

  const normalized = transcript.toLowerCase();
  if (normalized.includes('correo') || normalized.includes('email')) {
    return 'email';
  }

  if (normalized.includes('mejora') || normalized.includes('redacta') || normalized.includes('prompt')) {
    return 'rewrite';
  }

  return 'answer';
}
