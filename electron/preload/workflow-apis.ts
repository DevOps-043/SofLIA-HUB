import type {
  PreloadBridge,
  SafeIpc,
} from './types';

export function exposeWorkflowApis(bridge: PreloadBridge, ipc: SafeIpc): void {
  const { safeInvoke, safeOn, safeRemoveAllListeners } = ipc;
  bridge.exposeInMainWorld('automation', {
    listTemplates: () => safeInvoke('automation:list-templates'),
    listRuns: (limit?: number) => safeInvoke('automation:list-runs', limit),
    createCustomTemplate: (input: any) => safeInvoke('automation:create-custom-template', input),
    getRun: (runId: string) => safeInvoke('automation:get-run', runId),
    executeTemplate: (input: any) => safeInvoke('automation:execute-template', input),
    approveRun: (input: any) => safeInvoke('automation:approve-run', input),
    rejectRun: (input: any) => safeInvoke('automation:reject-run', input),
  });
  bridge.exposeInMainWorld('workflowHub', {
    getOverview: () => safeInvoke('workflow-hub:get-overview'),
    getCaseDetail: (caseId: string) => safeInvoke('workflow-hub:get-case-detail', caseId),
    executeWorkflow: (input: any) => safeInvoke('workflow-hub:execute-workflow', input),
    saveVariant: (input: any) => safeInvoke('workflow-hub:save-variant', input),
    savePassiveRule: (input: any) => safeInvoke('workflow-hub:save-passive-rule', input),
    deletePassiveRule: (ruleId: string) => safeInvoke('workflow-hub:delete-passive-rule', ruleId),
    approveCase: (input: any) => safeInvoke('workflow-hub:approve-case', input),
    rejectCase: (input: any) => safeInvoke('workflow-hub:reject-case', input),
    updateCaseAction: (input: any) => safeInvoke('workflow-hub:update-case-action', input),
    syncCase: (input: any) => safeInvoke('workflow-hub:sync-case', input),
  });
  bridge.exposeInMainWorld('meeting', {
    listRuns: (filters?: any) => safeInvoke('meeting:list-runs', filters),
    getRunDetail: (runId: string) => safeInvoke('meeting:get-run-detail', runId),
    createManualRun: (input: any) => safeInvoke('meeting:create-manual-run', input),
    createDriveRun: (input: any) => safeInvoke('meeting:create-drive-run', input),
    approveAsset: (input: any) => safeInvoke('meeting:approve-asset', input),
    approveActions: (input: any) => safeInvoke('meeting:approve-actions', input),
    updateAction: (input: any) => safeInvoke('meeting:update-action', input),
    rejectAction: (input: any) => safeInvoke('meeting:reject-action', input),
    syncApprovedActions: (input: any) => safeInvoke('meeting:sync-approved-actions', input),
    getFollowups: (ownerUserId?: string) => safeInvoke('meeting:get-followups', ownerUserId),
    getContext: () => safeInvoke('meeting:get-context'),
    onDetected: (cb: (payload: any) => void) => safeOn('meeting:detected', cb),
    removeListeners: () => safeRemoveAllListeners('meeting:detected'),
  });
}
