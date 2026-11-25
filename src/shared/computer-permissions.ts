export type ComputerPermissionMode = 'review' | 'full';

export interface ComputerPermissionResponse {
  success: boolean;
  mode?: ComputerPermissionMode;
  error?: string;
}
