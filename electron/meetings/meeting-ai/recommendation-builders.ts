import type { MeetingContextPack } from '../meeting-context-pack';
import type {
  MeetingAnalysisDestinationRecommendation,
  MeetingAnalysisFollowUpRecommendation,
  MeetingAnalysisResult,
} from '../meeting-types';
import { getMeetingTypeDefinition } from './text-helpers';

export function buildFollowUpRecommendation(
  tasks: MeetingAnalysisResult['tasks'],
  risks: MeetingAnalysisResult['risks'],
  openQuestions: MeetingAnalysisResult['openQuestions'],
): MeetingAnalysisFollowUpRecommendation {
  if (openQuestions.length > 0) {
    return {
      suggested: true,
      type: 'validation',
      description: 'Resolver las preguntas abiertas y confirmar la interpretacion de la reunion.',
      confidence: 0.76,
      reason: 'Quedaron preguntas abiertas sin cierre explicito.',
    };
  }

  const tasksMissingOwner = tasks.filter((task) => !task.ownerSuggested);
  const tasksMissingDate = tasks.filter((task) => !task.dueDateSuggested);
  if (tasksMissingOwner.length > 0 || tasksMissingDate.length > 0) {
    return {
      suggested: true,
      type: 'message',
      description: 'Confirmar responsables y fechas de las tareas detectadas antes de sincronizar.',
      confidence: 0.72,
      reason: 'Hay tareas sin owner o sin fecha sugerida.',
    };
  }

  const criticalRisk = risks.find((risk) => risk.severity === 'critical' || risk.severity === 'high');
  if (criticalRisk) {
    return {
      suggested: true,
      type: 'escalation',
      description: `Escalar el riesgo principal: ${criticalRisk.description}.`,
      confidence: 0.74,
      reason: 'Se detecto un bloqueo o riesgo de severidad alta.',
    };
  }

  return {
    suggested: false,
    confidence: 0.6,
    reason: 'La reunion ya deja un siguiente paso razonablemente claro.',
  };
}

export function buildDestinationRecommendation(
  suggestedType: string,
  confidence: number,
  reason: string,
  contextPack: MeetingContextPack,
): MeetingAnalysisDestinationRecommendation {
  if (confidence < contextPack.fallbackThreshold) {
    return {
      suggestedDestination: 'None',
      confidence: 0.4,
      reason: 'La clasificacion es baja y no conviene empujar un destino operativo todavia.',
    };
  }

  const meetingType = getMeetingTypeDefinition(contextPack, suggestedType);
  return {
    suggestedDestination: meetingType?.defaultDestination || 'None',
    confidence: Math.min(confidence, 0.86),
    reason,
  };
}
