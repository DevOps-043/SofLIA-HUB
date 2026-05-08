import type { MeetingStore } from '../meeting-store.ts';
import { getMeetingIrisClient } from '../meeting-iris-client';
import type { CreateMeetingRunInput, MeetingSourceArtifactRecord } from '../meeting-types';
import { nowIso, makeId, throwOnError } from './shared';

export async function addSourceArtifact(this: MeetingStore, runId: string, input: CreateMeetingRunInput['source']): Promise<MeetingSourceArtifactRecord> {
    const supabase = getMeetingIrisClient();
    const record: MeetingSourceArtifactRecord = {
      id: makeId('msrc'),
      meeting_run_id: runId,
      source_system: input.source_system,
      source_type: input.source_type,
      source_uri: input.source_uri ?? null,
      external_file_id: input.external_file_id ?? null,
      mime_type: input.mime_type ?? null,
      authority_level: input.authority_level,
      sha256: input.content_hash,
      normalized_text: input.normalized_text,
      metadata: input.metadata,
      created_at: nowIso(),
    };

    const { error } = await supabase
      .from('meeting_source_artifacts')
      .insert({
        ...record,
        metadata_json: record.metadata,
      });

    throwOnError(error, 'addSourceArtifact');
    return record;
  }
