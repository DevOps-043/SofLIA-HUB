import { z } from 'zod';

export const PROJECT_UPLOAD_MAX_FILES = 10;
export const PROJECT_UPLOAD_MAX_BYTES = 20 * 1024 * 1024;
export const PROJECT_UPLOAD_TIMEOUT_MS = 30_000;
export const PROJECT_UPLOAD_BUDGET_MS = 180_000;
export const projectUploadInput = z.object({ workspaceId: z.string().uuid(), projectId: z.string().uuid(), operationId: z.string().uuid() }).strict();
export const projectUploadCancel = projectUploadInput.pick({ operationId: true });
export type ProjectUploadInput = z.infer<typeof projectUploadInput>;
export const PROJECT_DOWNLOAD_TIMEOUT_MS = 30_000;
export const PROJECT_DOWNLOAD_BUDGET_MS = 90_000;
export const projectDownloadInput = projectUploadInput.extend({ evidenceId: z.string().uuid() });
export type ProjectDownloadInput = z.infer<typeof projectDownloadInput>;
export interface ProjectDownloadResult {
  success: boolean;
  data?: { saved: boolean; bytes: number };
  code?: string;
  error?: string;
  cancelled?: boolean;
  uncertain?: boolean;
  recoveryRequired?: boolean;
}
export interface ProjectUploadDeclaration { name: string; mime_type: string; size: number; sha256: string }
export interface ProjectUploadProgress { requested: number; prepared: number; stored: number; uploaded: number }
export interface ProjectUploadResult {
  success: boolean;
  data?: ProjectUploadProgress;
  code?: string;
  error?: string;
  cancelled?: boolean;
  partial?: boolean;
  uncertain?: boolean;
  recoveryRequired?: boolean;
}
