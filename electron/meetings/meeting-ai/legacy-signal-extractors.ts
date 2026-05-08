import type { LegacySignal } from './internal-types';
import {
  extractDueDate,
  extractOwnerCandidate,
  stripLabel,
} from './text-helpers';
import { inferPriority, inferSeverity } from './value-helpers';
import type { MeetingAnalysisResult } from '../meeting-types';

export function extractDecisionSignals(lines: string[]): LegacySignal[] {
  return extractLegacySignals(lines, /^(?:[-*]\s*)?(decision|decisiones|acuerdo|approved)\b/i, 0.76);
}

export function extractAgreementSignals(lines: string[]): LegacySignal[] {
  return extractLegacySignals(lines, /^(?:[-*]\s*)?(agreement|acuerdo|alineado|se acuerda)\b/i, 0.72);
}

export function extractTaskSignals(lines: string[]): MeetingAnalysisResult['tasks'] {
  return lines
    .filter((line) => /^(?:[-*]\s*)?(accion|acci\u00f3n|tarea|compromiso|todo)\b/i.test(line) || /^\[\s?\]\s+/.test(line))
    .map((line) => {
      const ownerSuggested = extractOwnerCandidate(line);
      const dueDateSuggested = extractDueDate(line);
      return {
        description: stripLabel(line.replace(/^\[\s?\]\s+/, '')),
        ownerSuggested,
        ownerConfidence: ownerSuggested ? 0.7 : undefined,
        dueDateSuggested,
        prioritySuggested: inferPriority(line),
        reason: ownerSuggested || dueDateSuggested
          ? 'La tarea aparece formulada como accion o compromiso explicito.'
          : 'Hay una referencia explicita a una accion, pero faltan datos de cierre.',
        confidence: ownerSuggested || dueDateSuggested ? 0.76 : 0.68,
        requiresHumanReview: true,
        evidence: [line],
      };
    })
    .filter((task) => task.description.trim().length > 0);
}

export function extractRiskSignals(lines: string[]): MeetingAnalysisResult['risks'] {
  return lines
    .filter((line) => /^(?:[-*]\s*)?(bloqueo|blocker|riesgo|issue|problema)\b/i.test(line))
    .map((line) => ({
      description: stripLabel(line),
      severity: inferSeverity(line),
      confidence: /critico|critical|alto/i.test(line) ? 0.82 : 0.7,
      reason: line,
    }));
}

export function extractOpenQuestionSignals(lines: string[]): MeetingAnalysisResult['openQuestions'] {
  return lines
    .filter((line) => /^(?:[-*]\s*)?(pregunta|question|duda)\b/i.test(line))
    .map((line) => ({ question: stripLabel(line), confidence: 0.68 }));
}

export function extractUnresolvedSignals(
  lines: string[],
  risks: MeetingAnalysisResult['risks'],
): MeetingAnalysisResult['unresolvedItems'] {
  const explicit = lines
    .filter((line) => /^(?:[-*]\s*)?(parking|tema pendiente|backlog|pendiente)\b/i.test(line))
    .map((line) => ({ item: stripLabel(line), reasonOpen: 'Quedo marcado como pendiente o parking lot.', confidence: 0.7 }));
  const derived = risks
    .filter((risk) => risk.severity === 'high' || risk.severity === 'critical')
    .map((risk) => ({
      item: risk.description,
      reasonOpen: 'El bloqueo o riesgo sigue sin cierre explicito.',
      confidence: Math.max(risk.confidence - 0.05, 0.6),
    }));
  return [...explicit, ...derived].slice(0, 6);
}

export function buildKeyPoints(
  lines: string[],
  tasks: MeetingAnalysisResult['tasks'],
  risks: MeetingAnalysisResult['risks'],
  decisions: LegacySignal[],
): string[] {
  const keyPoints = [
    ...decisions.slice(0, 2).map((decision) => `Decision: ${decision.value}`),
    ...tasks.slice(0, 3).map((task) => `Accion: ${task.description}`),
    ...risks.slice(0, 2).map((risk) => `Riesgo: ${risk.description}`),
  ];
  return keyPoints.length > 0 ? keyPoints : lines.filter((line) => line.length > 24).slice(0, 4).map(truncateKeyPoint);
}

function extractLegacySignals(lines: string[], pattern: RegExp, confidence: number): LegacySignal[] {
  return lines.filter((line) => pattern.test(line)).map((line) => ({ value: stripLabel(line), evidence: [line], confidence }));
}

function truncateKeyPoint(line: string): string {
  return line.length > 180 ? `${line.slice(0, 177).trim()}...` : line;
}
