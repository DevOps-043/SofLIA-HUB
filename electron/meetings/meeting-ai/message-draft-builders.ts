import type {
  MeetingAnalysisDestinationRecommendation,
  MeetingAnalysisFollowUpRecommendation,
  MeetingAnalysisMessageDraft,
  MeetingAnalysisResult,
} from '../meeting-types';

export function buildMessageDrafts(
  destination: MeetingAnalysisDestinationRecommendation,
  followUp: MeetingAnalysisFollowUpRecommendation,
  keyPoints: string[],
  tasks: MeetingAnalysisResult['tasks'],
): MeetingAnalysisMessageDraft[] {
  const drafts: MeetingAnalysisMessageDraft[] = [];

  if (destination.suggestedDestination === 'Team' && keyPoints.length > 0) {
    drafts.push({
      kind: 'team_summary',
      content: [
        'Resumen operativo de la reunion:',
        ...keyPoints.slice(0, 4).map((point) => `- ${point}`),
      ].join('\n'),
      requiresApproval: true,
    });
  }

  if (followUp.suggested) {
    drafts.push({
      kind: 'follow_up',
      content: followUp.description || followUp.reason,
      requiresApproval: true,
    });
  }

  const ownerlessTask = tasks.find((task) => !task.ownerSuggested);
  if (ownerlessTask) {
    drafts.push({
      kind: 'owner_confirmation',
      content: `Confirmar responsable para: ${ownerlessTask.description}`,
      requiresApproval: true,
    });
  }

  return drafts.slice(0, 3);
}
