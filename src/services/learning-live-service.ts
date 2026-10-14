import { parseLearningLiveSession, type LearningLiveSessionReference, type LearningLiveOpenResult } from '../shared/learning-live-session';
import { workspaceResponseSchema, type WorkspaceOperation } from '../shared/learning-workspace.contract';
import type { LearningWorkspaceResult } from '../shared/learning-workspace';
import { liveCatalogResponseSchema, type LiveCatalogRequest, type LiveCatalogResult } from '../shared/learning-live-catalog';
import type { StudioResult, studioOperationSchema } from '../shared/live-studio.contract';
import type { z } from 'zod';

interface LearningLiveApi {
  sdkFrameUrl?: 'soflia-zoom://meeting/index.html';
  studio?: (reference: LearningLiveSessionReference, operation: z.infer<typeof studioOperationSchema>) => Promise<StudioResult>;
  watchStudio?: (reference: LearningLiveSessionReference) => Promise<{ success: boolean; error?: string }>;
  unwatchStudio?: () => Promise<unknown>;
  onStudioEvent?: (callback: (notice: unknown) => void) => () => void;
  catalog?: (request: LiveCatalogRequest) => Promise<LiveCatalogResult>;
  workspace: (reference: LearningLiveSessionReference, operation: WorkspaceOperation) => Promise<LearningWorkspaceResult>;
  open: (reference: LearningLiveSessionReference) => Promise<LearningLiveOpenResult>;
  getPending: () => Promise<LearningLiveSessionReference | null>;
  onRequested: (callback: (reference: LearningLiveSessionReference) => void) => () => void;
}

declare global { interface Window { learningLive?: LearningLiveApi } }

export const learningLiveService = {
  async catalog(request: LiveCatalogRequest): Promise<LiveCatalogResult> {
    if (!window.learningLive?.catalog) return { success: false, code: 'unavailable', error: 'Actualiza Soflia Hub para consultar tus sesiones.' };
    const result = await window.learningLive.catalog(request);
    if (!result.success) return result;
    const parsed = liveCatalogResponseSchema.safeParse(result.catalog);
    return parsed.success ? { success: true, catalog: parsed.data } : { success: false, code: 'unavailable', error: 'Learning devolvió una agenda incompatible.' };
  },
  async workspace(reference: LearningLiveSessionReference, operation: WorkspaceOperation): Promise<LearningWorkspaceResult> {
    if (!window.learningLive?.workspace) return { success: false, code: 'unavailable', error: 'Actualiza Soflia Hub para abrir el aula colaborativa.' };
    const result = await window.learningLive.workspace(reference, operation);
    if (!result.success) return result;
    const response = { ...(result.snapshot ? { snapshot: result.snapshot } : {}), ...(result.private_answer ? { private_answer: result.private_answer } : {}), ...(result.pulse_suggestion ? { pulse_suggestion: result.pulse_suggestion } : {}) };
    const parsed = workspaceResponseSchema.safeParse(response);
    return parsed.success ? { success: true, ...parsed.data } : { success: false, code: 'unavailable', error: 'El aula devolvió datos incompatibles.' };
  },
  subscribe(callback: (reference: LearningLiveSessionReference) => void): () => void {
    return window.learningLive?.onRequested((input) => {
      const reference = parseLearningLiveSession(input);
      if (reference) callback(reference);
    }) || (() => {});
  },
  async getPending(): Promise<LearningLiveSessionReference | null> {
    return parseLearningLiveSession(await window.learningLive?.getPending());
  },
  async open(reference: LearningLiveSessionReference): Promise<LearningLiveOpenResult> {
    if (!window.learningLive) return { success: false, error: 'Abre esta sesión en Soflia Hub de escritorio.' };
    return window.learningLive.open(reference);
  },
};
