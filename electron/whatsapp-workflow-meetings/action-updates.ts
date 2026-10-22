import type { UpdateMeetingActionInput } from '../meetings/meeting-types';

export function parseMeetingActionUpdates(rawText: string): UpdateMeetingActionInput {
  const updates: UpdateMeetingActionInput = {};
  const tokenRegex = /([a-z_]+)=("([^"]*)"|'([^']*)'|(\S+))/gi;
  let match: RegExpExecArray | null = tokenRegex.exec(rawText);
  while (match) {
    const key = match[1].toLowerCase();
    const value = match[3] || match[4] || match[5] || '';
    if (key === 'titulo' || key === 'title') updates.title = value;
    if (key === 'fecha' || key === 'due') updates.due_date = value;
    if (key === 'responsable' || key === 'owner') updates.owner_candidate = value;
    match = tokenRegex.exec(rawText);
  }
  return updates;
}
