export type UpdatePhase = 'hidden' | 'available' | 'downloading' | 'ready' | 'error';

export interface UpdateNotificationState {
  phase: UpdatePhase;
  version: string;
  releaseNotes: string | null;
  progress: number;
  error: string | null;
  dismissed: boolean;
  showNotes: boolean;
}
