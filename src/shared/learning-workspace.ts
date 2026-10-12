import type { WorkspaceResponse } from './learning-workspace.contract';
export type LearningWorkspaceResult =
  | ({ success: true } & WorkspaceResponse)
  | { success: false; code: 'not_ready' | 'access_denied' | 'unavailable'; error: string };
