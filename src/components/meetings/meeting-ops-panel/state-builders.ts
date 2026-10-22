import type {
  MeetingRunDetail,
} from '../../../services/meeting-service';
import type { ActionDraft } from './types';

const EMPTY_ACTION_DRAFT: ActionDraft = {
  title: '',
  dueDate: '',
};

export function buildActionDrafts(detail: MeetingRunDetail | null): Record<string, ActionDraft> {
  if (!detail) return {};

  const nextDrafts: Record<string, ActionDraft> = {};
  for (const action of detail.sync_actions) {
    nextDrafts[action.id] = {
      title: action.payload.title || action.summary || '',
      dueDate: action.payload.due_date || '',
    };
  }
  return nextDrafts;
}

export function patchActionDraft(
  current: Record<string, ActionDraft>,
  actionId: string,
  patch: Partial<ActionDraft>,
): Record<string, ActionDraft> {
  return {
    ...current,
    [actionId]: { ...(current[actionId] || EMPTY_ACTION_DRAFT), ...patch },
  };
}
