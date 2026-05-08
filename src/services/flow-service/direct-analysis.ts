import type { FlowAnalysisResult } from './types';
import { normalizePotentialUrl, stripTrailingPunctuation } from './target-url';

export function buildDirectOpenAnalysis(
  transcript: string,
  target: string,
  type: 'open_application' | 'open_url',
): FlowAnalysisResult {
  const cleanedTarget = stripTrailingPunctuation(target);
  const url = type === 'open_url' ? normalizePotentialUrl(cleanedTarget) : null;
  const resolvedTarget = type === 'open_application' ? cleanedTarget : undefined;

  return {
    intent: 'instruction',
    mode: 'action',
    title: '',
    lead: '',
    response: type === 'open_url' ? `Voy a abrir ${url || cleanedTarget}.` : `Voy a abrir ${cleanedTarget}.`,
    confidence: 0.98,
    transcript,
    missing: [],
    chatPrompt: transcript,
    action: {
      type,
      label: type === 'open_url' ? 'Abrir enlace' : 'Abrir aplicacion',
      description:
        type === 'open_url'
          ? `Abrira ${url || cleanedTarget} en tu navegador.`
          : `Abrira ${cleanedTarget} en tu equipo.`,
      target: resolvedTarget,
      url: url || undefined,
      autoExecute: true,
      requiresConfirmation: false,
    },
  };
}

export function buildDesktopAutomationAnalysis(transcript: string, response?: string): FlowAnalysisResult {
  return {
    intent: 'automation',
    mode: 'action',
    title: '',
    lead: '',
    response: response || 'Voy a intentar esta tarea en tu escritorio.',
    confidence: 0.93,
    transcript,
    missing: [],
    chatPrompt: transcript,
    action: {
      type: 'desktop_automation',
      label: 'Automatizar tarea',
      description: 'Usara el agente de escritorio para completar la tarea solicitada.',
      task: transcript,
      autoExecute: true,
      requiresConfirmation: false,
    },
  };
}
