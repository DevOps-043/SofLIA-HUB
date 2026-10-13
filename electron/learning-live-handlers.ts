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
import { requestLearningStudio } from './learning-studio-access';
import { studioReferenceSchema, studioRequestSchema } from '../src/shared/live-studio.contract';
import { subscribeStudioRevisions } from './learning-studio-realtime';

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
  const studioWatches = new Map<number, () => void>();
  const studioGenerations = new Map<number, number>();
  const stopStudioWatch = (id: number) => {
    studioGenerations.set(id, (studioGenerations.get(id) ?? 0) + 1);
    studioWatches.get(id)?.(); studioWatches.delete(id);
  };
  ipcMain.handle('learning-live:studio', async (_event, input: unknown) => {
    if (!studioRequestSchema.safeParse(input).success) return { success: false, code: 'access_denied', error: 'Solicitud del estudio inválida.' };
    if (workspaceInFlight >= 4) return { success: false, code: 'unavailable', error: 'Espera a que termine la operación anterior.' };
    workspaceInFlight++;
    try { return await requestLearningStudio(input, { baseUrl: readLearningBaseUrl(), getIdentity: readIdentity }); }
    finally { workspaceInFlight--; }
  });
  ipcMain.handle('learning-live:unwatch-studio', (event) => { stopStudioWatch(event.sender.id); return { success: true }; });
  ipcMain.handle('learning-live:watch-studio', async (event, input: unknown) => {
    const reference = studioReferenceSchema.safeParse(input);
    if (!reference.success || workspaceInFlight >= 4) return { success: false, error: 'No se pudo iniciar Realtime.' };
    const id = event.sender.id;
    stopStudioWatch(id);
    const generation = studioGenerations.get(id);
    workspaceInFlight++;
    try {
    const identity = await readIdentity();
    const client = getSofiaClient();
    if (!reference.success || !identity || !client) return { success: false, error: 'No se pudo iniciar Realtime.' };
    const access = await requestLearningStudio({ ...reference.data, operation: { type: 'snapshot' } }, { baseUrl: readLearningBaseUrl(), getIdentity: readIdentity });
    if (!access.success || !access.snapshot || event.sender.isDestroyed() || studioGenerations.get(id) !== generation || getSofiaSessionUserId() !== identity.userId) return { success: false, error: 'Learning no autorizó Realtime.' };
    const stop = subscribeStudioRevisions(client, reference.data, (notice) => {
      if (getSofiaSessionUserId() === identity.userId && !event.sender.isDestroyed()) event.sender.send('learning-live:studio-event', notice);
      else stopStudioWatch(id);
    });
    const destroyed = () => { stopStudioWatch(id); studioGenerations.delete(id); };
    const cleanup = () => { stop(); event.sender.removeListener('destroyed', destroyed); };
    studioWatches.set(id, cleanup);
    event.sender.once('destroyed', destroyed);
    return { success: true };
    } finally { workspaceInFlight--; }
  });
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
