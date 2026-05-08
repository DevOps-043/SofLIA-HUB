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
    if (key === 'team' || key === 'equipo') updates.team_id = value;
    if (key === 'proyecto' || key === 'project') updates.project_id = value;
    if (key === 'responsable' || key === 'owner') updates.owner_candidate = value;
    if (key === 'assignee' || key === 'usuario') updates.assignee_id = value;
    match = tokenRegex.exec(rawText);
  }
  return updates;
}
