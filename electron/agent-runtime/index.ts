import path from 'node:path';
import type { BrowserWindow } from 'electron';
import type { MeetingWorkflowService } from '../meetings/meeting-workflow-service';
import { AgentRuntime } from './runtime';
import { registerAgentRuntimeHandlers } from './handlers';
import { getAuthState, onAuthStateChange } from '../main/auth-state';
import type { AgentScope } from '../../src/shared/agent-runtime';
import { initializeAgentActivity } from '../agent-activity';

export async function initializeAgentRuntime(input: {
  getWindow(): BrowserWindow | null;
  geminiKey(): string | null;
  meetings: MeetingWorkflowService;
}): Promise<() => void> {
  const { app, safeStorage } = await import('electron');
  const { getSofiaClient } = await import('../iris/clients');
  const { getSofiaSessionUserId } = await import('../main/sofia-session');
  const { getHubSessionUserId } = await import('../main/hub-session');
  const getUserId = () => {
    const state = getAuthState();
    return state.authenticated && state.userId === getSofiaSessionUserId() ? state.userId : null;
  };
  const runtime = new AgentRuntime({
    root: path.join(app.getPath('userData'), 'agent-runtime'),
    cipher: {
      isEncryptionAvailable: () => safeStorage.isEncryptionAvailable() && (process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text'),
      encryptString: value => safeStorage.encryptString(value),
      decryptString: value => safeStorage.decryptString(value),
    },
    getUserId, getMeetingOwnerId: getHubSessionUserId, geminiKey: input.geminiKey, meetings: input.meetings,
    authorize: async (scope: AgentScope) => {
      if (getUserId() !== scope.userId) throw new Error('Sesión SOFIA no disponible.');
      if (!scope.organizationId) return;
      const client = getSofiaClient();
      if (!client) throw new Error('No se pudo comprobar la organización.');
      const { data, error } = await client.from('organization_users').select('organization_id')
        .eq('user_id', scope.userId).eq('organization_id', scope.organizationId).eq('status', 'active').limit(1)
        .abortSignal(AbortSignal.timeout(15_000)).maybeSingle();
      if (error || !data || getUserId() !== scope.userId) throw new Error('Organización no autorizada.');
    },
  });
  const unregister = registerAgentRuntimeHandlers(runtime, input.getWindow);
  const closeActivity = initializeAgentActivity({ getWindow: input.getWindow, getUserId, onAuthChange: onAuthStateChange, harness: runtime.harness });
  const unsubscribe = onAuthStateChange(() => runtime.invalidate());
  const close = () => { closeActivity(); unsubscribe(); unregister(); runtime.harness.close(); };
  app.once('before-quit', close);
  return () => { app.off('before-quit', close); close(); };
}
