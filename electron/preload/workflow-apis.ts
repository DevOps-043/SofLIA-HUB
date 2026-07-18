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
    getOverview: (organizationId?: string) => safeInvoke('workflow-hub:get-overview', organizationId),
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
  // SDO-AN: Registro Operativo Gobernado. approve/reject solo desde la UI
  // (usuario SOFIA); las herramientas de agente no tienen ruta de aprobacion.
  bridge.exposeInMainWorld('sdo', {
    listDecisions: (filters?: unknown) => safeInvoke('sdo:list-decisions', filters),
    getDecision: (decisionId: string) => safeInvoke('sdo:get-decision', decisionId),
    createDecision: (input: unknown) => safeInvoke('sdo:create-decision', input),
    listClaims: (filters?: unknown) => safeInvoke('sdo:list-claims', filters),
    createClaim: (input: unknown) => safeInvoke('sdo:create-claim', input),
    listActions: (filters?: unknown) => safeInvoke('sdo:list-actions', filters),
    createAction: (input: unknown) => safeInvoke('sdo:create-action', input),
    updateAction: (input: unknown) => safeInvoke('sdo:update-action', input),
    approve: (input: unknown) => safeInvoke('sdo:approve', input),
    reject: (input: unknown) => safeInvoke('sdo:reject', input),
    listAudit: (input: unknown) => safeInvoke('sdo:list-audit', input),
    generateDocument: (input: unknown) => safeInvoke('sdo:generate-document', input),
    getContextCard: (input: unknown) => safeInvoke('sdo:get-context-card', input),
    listArtifacts: (filters?: unknown) => safeInvoke('sdo:list-artifacts', filters),
    approveArtifact: (input: unknown) => safeInvoke('sdo:approve-artifact', input),
    getStatus: () => safeInvoke('sdo:get-status'),
  });
  bridge.exposeInMainWorld('meetingLive', {
    start: (input?: { title?: string; language?: string; modelSize?: string; screenshotIntervalMs?: number }) =>
      safeInvoke('meeting-live:start', input),
    stop: () => safeInvoke('meeting-live:stop'),
    getStatus: () => safeInvoke('meeting-live:status'),
    pushAudioChunk: (input: { source: 'mic' | 'system'; audioB64: string }) =>
      safeInvoke('meeting-live:audio-chunk', input),
    setLoopback: (enabled: boolean) => safeInvoke('meeting-live:set-loopback', enabled),
    dismissDetection: () => safeInvoke('meeting-live:dismiss-detection'),
    createRun: (input: { ownerUserId: string; organizationId?: string | null; meetingTitle?: string | null }) =>
      safeInvoke('meeting-live:create-run', input),
    onSegment: (cb: (payload: unknown) => void) => safeOn('meeting-live:segment', cb),
    onStatusChanged: (cb: (payload: unknown) => void) => safeOn('meeting-live:status-changed', cb),
    onError: (cb: (payload: unknown) => void) => safeOn('meeting-live:error', cb),
    onMeetingDetected: (cb: (payload: unknown) => void) => safeOn('meeting-live:meeting-detected', cb),
    removeListeners: () => {
      safeRemoveAllListeners('meeting-live:segment');
      safeRemoveAllListeners('meeting-live:status-changed');
      safeRemoveAllListeners('meeting-live:error');
      safeRemoveAllListeners('meeting-live:meeting-detected');
    },
  });
}
