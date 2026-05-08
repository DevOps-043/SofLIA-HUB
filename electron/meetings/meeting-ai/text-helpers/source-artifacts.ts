import type { MeetingContextPack, MeetingTypeDefinition } from '../../meeting-context-pack';
import type { MeetingSourceArtifactRecord } from '../../meeting-types';

export function describeSource(sourceArtifact: MeetingSourceArtifactRecord): string {
  const metadata = sourceArtifact.metadata || {};
  const parts = [
    sourceArtifact.source_type,
    sourceArtifact.source_uri || null,
    typeof metadata.file_name === 'string' ? metadata.file_name : null,
  ].filter(Boolean);
  return parts.join(' | ') || 'Fuente sin descripcion';
}

export function extractDateTimeHint(sourceArtifact: MeetingSourceArtifactRecord): string | null {
  const metadata = sourceArtifact.metadata || {};
  const candidates = [metadata.created_time, metadata.imported_at, metadata.date];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
  }
  return null;
}

export function getMeetingTypeDefinition(
  contextPack: MeetingContextPack,
  meetingTypeId: string,
): MeetingTypeDefinition | null {
  return contextPack.meetingTypes.find((meetingType) => meetingType.id === meetingTypeId) || null;
}
