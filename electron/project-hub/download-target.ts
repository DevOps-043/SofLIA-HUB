import path from 'node:path';
import { z } from 'zod';
import { PROJECT_UPLOAD_MAX_BYTES } from '../../src/shared/project-hub-files';
import { ProjectHubError, projectHubToken } from './session-contract';
import { projectFileMime } from './file-format';

const evidenceSchema = z.object({
  evidence_id: z.string().uuid(), workspace_id: z.string().uuid(), project_id: z.string().uuid(), evidence_type: z.literal('upload'),
  archived_at: z.null(), storage_path: z.string().max(1024), mime_type: z.string().max(150),
  file_size_bytes: z.number().int().min(1).max(PROJECT_UPLOAD_MAX_BYTES), content_hash: z.string().regex(/^[a-f\d]{64}$/iu),
  title: z.string().max(500), metadata: z.object({ upload_state: z.literal('ready'), original_name: z.string().max(255).optional() }),
});
export interface ProjectDownloadDescription { name: string; extension: string; mime: string; size: number; sha256: string; storagePath: string }
const invalid = () => new ProjectHubError('INVALID_DOWNLOAD', 'No se pudo comprobar el archivo del proyecto.');
export function projectDownloadDescription(payload: unknown, target: { workspaceId: string; projectId: string; evidenceId: string }): ProjectDownloadDescription {
  const parsed = evidenceSchema.safeParse(payload); if (!parsed.success) throw invalid();
  const data = parsed.data; const extension = path.posix.extname(data.storage_path).slice(1).toLowerCase();
  if (data.evidence_id.toLowerCase() !== target.evidenceId.toLowerCase() || data.workspace_id.toLowerCase() !== target.workspaceId.toLowerCase()
    || data.project_id.toLowerCase() !== target.projectId.toLowerCase() || projectFileMime(extension) !== data.mime_type
    || data.storage_path !== `${target.workspaceId}/${target.projectId}/${data.evidence_id}.${extension}`) throw invalid();
  const proposed = data.metadata.original_name ?? data.title;
  const safe = proposed.length > 0 && proposed.length <= 255 && !/[<>:"/\\|?*]/u.test(proposed)
    && [...proposed].every(char => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127)
    && !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(proposed)
    && path.extname(proposed).slice(1).toLowerCase() === extension;
  return { name: safe ? proposed : `archivo-${data.evidence_id}.${extension}`, extension, mime: data.mime_type,
    size: data.file_size_bytes, sha256: data.content_hash.toLowerCase(), storagePath: data.storage_path };
}
export function projectDownloadUrl(payload: unknown, origin: string, file: ProjectDownloadDescription): string {
  const parsed = z.object({ signed_url: z.string().max(100_000), expires_in: z.number().int().min(1).max(300) }).strict().safeParse(payload);
  if (!parsed.success || !origin) throw invalid();
  try {
    const url = new URL(parsed.data.signed_url); const token = url.searchParams.get('token');
    if (url.origin !== origin || url.username || url.password || url.hash || parsed.data.signed_url.includes('\\')
      || url.pathname !== `/storage/v1/object/sign/project-files/${file.storagePath}` || [...url.searchParams].length !== 1
      || !projectHubToken.safeParse(token).success) throw invalid();
    return url.href;
  } catch { throw invalid(); }
}
