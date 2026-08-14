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
  bridge.exposeInMainWorld('passiveSkills', {
    getOverview: () => safeInvoke('passive-skills:get-overview'),
    saveRule: (input: any) => safeInvoke('passive-skills:save-rule', input),
    deleteRule: (ruleId: string) => safeInvoke('passive-skills:delete-rule', ruleId),
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
