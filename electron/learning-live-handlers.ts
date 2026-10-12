import { ipcMain } from 'electron';
import { getSofiaClient } from './iris/clients';
import { getSofiaSessionUserId } from './main/sofia-session';
import { readLearningBaseUrl } from './learning-sso';
import { openLearningLiveSession } from './learning-live-access';
import { parseLearningLiveSession, type LearningLiveOpenResult, type LearningLiveSessionReference } from '../src/shared/learning-live-session';
import { requestLearningWorkspace } from './learning-workspace-access';
import { workspaceRequestSchema } from '../src/shared/learning-workspace.contract';
import { requestLearningLiveCatalog } from './learning-live-catalog';
import { liveCatalogRequestSchema } from '../src/shared/learning-live-catalog';

async function readIdentity() {
  const client = getSofiaClient();
  const expectedUser = getSofiaSessionUserId();
  if (!client || !expectedUser) return null;
  const { data, error } = await client.auth.getSession();
  if (error || data.session?.user.id !== expectedUser) return null;
  return { userId: expectedUser, accessToken: data.session.access_token };
}

export function registerLearningLiveHandlers(openTab: (url: string) => Promise<unknown>, onProcessed: (reference: LearningLiveSessionReference) => void): void {
  const pending = new Map<string, Promise<LearningLiveOpenResult>>();
  ipcMain.handle('learning-live:open', async (_event, input: unknown) => {
    const reference = parseLearningLiveSession(input);
    if (!reference) return { success: false, error: 'Referencia de sesión inválida.' };
    const key = `${getSofiaSessionUserId()}:${reference.organization_slug}:${reference.session_id}`;
    const current = pending.get(key);
    if (current) return current;
    const operation = openLearningLiveSession(reference, {
      baseUrl: readLearningBaseUrl(), openTab,
      getIdentity: readIdentity,
    }).then((result) => { if (result.code !== 'not_ready') onProcessed(reference); return result; })
      .finally(() => pending.delete(key));
    pending.set(key, operation);
    return operation;
  });
  let workspaceInFlight = 0;
  ipcMain.handle('learning-live:catalog', async (_event, input: unknown) => {
    const parsed = liveCatalogRequestSchema.safeParse(input);
    if (!parsed.success) return { success: false, code: 'access_denied', error: 'Solicitud de sesiones inválida.' };
    if (workspaceInFlight >= 4) return { success: false, code: 'unavailable', error: 'Espera a que termine la consulta anterior.' };
    workspaceInFlight++;
    try { return await requestLearningLiveCatalog(parsed.data, { baseUrl: readLearningBaseUrl(), getIdentity: readIdentity }); }
    finally { workspaceInFlight--; }
  });
  ipcMain.handle('learning-live:workspace', async (_event, input: unknown) => {
    const parsed = workspaceRequestSchema.safeParse(input);
    if (!parsed.success) return { success: false, code: 'access_denied', error: 'Solicitud del aula inválida.' };
    if (workspaceInFlight >= 4) return { success: false, code: 'unavailable', error: 'Espera a que termine la operación anterior.' };
    workspaceInFlight++;
    try {
      return await requestLearningWorkspace(parsed.data, { baseUrl: readLearningBaseUrl(), getIdentity: readIdentity });
    } finally { workspaceInFlight--; }
  });
}
