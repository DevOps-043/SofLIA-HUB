import type { MeetingStore } from '../meeting-store.ts';
import type { MeetingSourceArtifactRecord } from '../meeting-types';
import { parseJson } from './shared';

export function mapSourceArtifact(this: MeetingStore, row: any): MeetingSourceArtifactRecord {
    return {
      id: row.id,
      meeting_run_id: row.meeting_run_id,
      source_system: row.source_system,
      source_type: row.source_type,
      source_uri: row.source_uri ?? null,
      external_file_id: row.external_file_id ?? null,
      mime_type: row.mime_type ?? null,
      authority_level: row.authority_level,
      sha256: row.sha256,
      normalized_text: row.normalized_text,
      metadata: parseJson(row.metadata_json, {}),
      created_at: row.created_at,
    };
  }
