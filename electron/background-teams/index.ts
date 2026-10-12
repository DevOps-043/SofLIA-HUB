import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import type { BrowserWindow } from 'electron';
import { getAuthState, onAuthStateChange } from '../main/auth-state';
import { getSofiaSessionUserId } from '../main/sofia-session';
import { getHubSessionUserId } from '../main/hub-session';
import { getWhatsAppOpenAIClient } from '../wa-agent/openai-client';
import { getSofiaClient } from '../iris/clients';
import { getHubDbClient } from '../hub-db-client';
import { isOpenAIModel } from '../../src/shared/model-providers';
import type { BackgroundScope } from '../../src/shared/background-teams';
import { BackgroundTeamService } from './service';
import { BackgroundRepository } from './repository';
import { GeminiBackgroundProvider, OpenAIBackgroundProvider } from './providers';
import { registerBackgroundTeamHandlers } from './handlers';
import { ArtifactViewerService, registerArtifactViewerHandlers } from '../artifact-viewer';
import { prepareOrganizationDocument } from '../organization-branding/document-branding';

export async function initializeBackgroundTeams(input: { getWindow(): BrowserWindow | null; geminiKey(): string | null }): Promise<() => void> {
  const { app, safeStorage } = await import('electron');
  const current = () => {
    const auth = getAuthState();
    if (!auth.authenticated || !auth.userId || auth.userId !== getSofiaSessionUserId()) throw new Error('Sesión SOFIA no disponible.');
    return { userId: auth.userId, dataUserId: getHubSessionUserId() };
  };
  const authorize = async (scope: BackgroundScope) => {
    const actor = current();
    if (actor.userId !== scope.userId || actor.dataUserId !== scope.dataUserId) throw new Error('El propietario cambió.');
    if (scope.organizationId) {
      const client = getSofiaClient();
      if (!client) throw new Error('Organización no verificable.');
      const { data, error } = await client.from('organization_users').select('organization_id').eq('user_id', scope.userId)
        .eq('organization_id', scope.organizationId).eq('status', 'active').limit(1).abortSignal(AbortSignal.timeout(15_000)).maybeSingle();
      if (error || !data) throw new Error('Organización no autorizada.');
    }
    const after = current();
    if (after.userId !== scope.userId || after.dataUserId !== scope.dataUserId) throw new Error('La sesión cambió.');
  };
  const service = new BackgroundTeamService({
    documentBranding: (job, disabled, guard) => prepareOrganizationDocument({ scope: job.scope, disabled, guard }),
    repository: new BackgroundRepository(path.join(app.getPath('userData'), 'background-teams'), {
      isEncryptionAvailable: () => safeStorage.isEncryptionAvailable() && (process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text'),
      encryptString: value => safeStorage.encryptString(value), decryptString: value => safeStorage.decryptString(value),
    }),
    resolveScope: async organizationId => { const scope = { ...current(), organizationId }; await authorize(scope); return scope; },
    authorize,
    verifyLegacyBinding: async (job, input) => {
      if (!job.scope.dataUserId) throw new Error('El mensaje no está disponible.');
      const { data, error } = await getHubDbClient().from('messages').select('id,content,created_at')
        .eq('id', input.messageId).eq('conversation_id', input.conversationId).eq('user_id', job.scope.dataUserId)
        .abortSignal(AbortSignal.timeout(15_000)).maybeSingle();
      if (error || !data || typeof data.content !== 'string' || !data.content.startsWith('Equipo ejecutor iniciado.')
        || !data.content.includes('Trabajo: ' + job.id)
        || !Number.isFinite(Date.parse(data.created_at)) || Math.abs(Date.parse(data.created_at) - Date.parse(job.createdAt)) > 900_000) throw new Error('El mensaje no pertenece a este trabajo.');
    },
    provider: async job => {
      await authorize(job.scope);
      if (isOpenAIModel(job.model)) return new OpenAIBackgroundProvider(await getWhatsAppOpenAIClient(), job.model);
      let key: string | null = null;
      if (job.scope.dataUserId) {
        const result = await getHubDbClient().rpc('get_api_key', { p_provider: 'gemini' }).abortSignal(AbortSignal.timeout(15_000));
        if (result.error) throw new Error('No se pudo consultar la configuración de Gemini.');
        key = typeof result.data === 'string' ? result.data : null;
      }
      key ||= input.geminiKey();
      if (!key?.trim()) throw new Error('Gemini no está configurado.');
      await authorize(job.scope);
      return new GeminiBackgroundProvider(new GoogleGenAI({ apiKey: key }), job.model);
    },
  });
  const unbind = registerBackgroundTeamHandlers(service, input.getWindow);
  // Una selección nativa solo requiere la sesión host; los archivos de equipos
  // conservan además la autorización de organización en artifactFile.
  const viewer = new ArtifactViewerService({ authorize: async () => { current(); }, contextToken: () => service.contextToken(),
    teamFile: async (jobId, artifactId) => {
      const file = await service.artifactFile(jobId, artifactId);
      const artifact = service.state().jobs.find(job => job.id === jobId)?.artifacts.find(item => item.id === artifactId && item.verified);
      if (!artifact) throw new Error('Archivo no disponible.');
      return { file, hash: artifact.hash };
    } });
  const unbindViewer = registerArtifactViewerHandlers(viewer, input.getWindow);
  const removeAuth = onAuthStateChange(() => { viewer.clear(); service.invalidate(); });
  const close = () => { removeAuth(); unbindViewer(); unbind(); service.close(); app.off('before-quit', close); };
  app.once('before-quit', close);
  return close;
}

