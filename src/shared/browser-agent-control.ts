export type BrowserAgentControlAction = 'pause' | 'resume' | 'stop' | 'take-control';
export interface BrowserAgentTaskState {
  taskId: string;
  revision: number;
  status: 'starting' | 'executing' | 'pausing' | 'paused' | 'stopping';
  currentStep: number;
  maxSteps: number;
}
export interface BrowserAgentControlRequest {
  taskId: string;
  taskRevision: number;
  profileRevision: number;
  action: BrowserAgentControlAction;
}
export interface BrowserAgentControlResponse { success: boolean; error?: string; agentTask?: BrowserAgentTaskState }

export function validateBrowserAgentControlRequest(input: unknown): BrowserAgentControlRequest {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).sort().join(',') !== 'action,profileRevision,taskId,taskRevision'
    || !('taskId' in input) || typeof input.taskId !== 'string'
    || !/^browser-cu-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(input.taskId)
    || !('profileRevision' in input) || typeof input.profileRevision !== 'number' || !Number.isSafeInteger(input.profileRevision) || input.profileRevision < 0
    || !('taskRevision' in input) || typeof input.taskRevision !== 'number' || !Number.isSafeInteger(input.taskRevision) || input.taskRevision < 0
    || !('action' in input) || typeof input.action !== 'string' || !['pause', 'resume', 'stop', 'take-control'].includes(input.action)) {
    throw new Error('Solicitud de supervisión inválida.');
  }
  return { taskId: input.taskId, taskRevision: input.taskRevision, profileRevision: input.profileRevision, action: input.action as BrowserAgentControlAction };
}
