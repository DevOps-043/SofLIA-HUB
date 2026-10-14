import type { PreloadBridge, SafeIpc } from './types';
import type { LearningLiveSessionReference } from '../../src/shared/learning-live-session';
import type { WorkspaceOperation } from '../../src/shared/learning-workspace.contract';
import type { LiveCatalogRequest } from '../../src/shared/learning-live-catalog';
import type { studioOperationSchema } from '../../src/shared/live-studio.contract';
import type { z } from 'zod';

export function exposeLearningLiveApi(bridge: PreloadBridge, ipc: SafeIpc): void {
  bridge.exposeInMainWorld('learningLive', {
    sdkFrameUrl: 'soflia-zoom://meeting/index.html',
    studio: (reference: LearningLiveSessionReference, operation: z.infer<typeof studioOperationSchema>) => ipc.safeInvoke('learning-live:studio', { ...reference, operation }),
    watchStudio: (reference: LearningLiveSessionReference) => ipc.safeInvoke('learning-live:watch-studio', reference),
    unwatchStudio: () => ipc.safeInvoke('learning-live:unwatch-studio'),
    onStudioEvent: (callback: (notice: unknown) => void) => ipc.safeOn('learning-live:studio-event', (_event: unknown, notice: unknown) => callback(notice)),
    catalog: (request: LiveCatalogRequest) => ipc.safeInvoke('learning-live:catalog', request),
    open: (reference: LearningLiveSessionReference) => ipc.safeInvoke('learning-live:open', reference),
    workspace: (reference: LearningLiveSessionReference, operation: WorkspaceOperation) => ipc.safeInvoke('learning-live:workspace', { ...reference, operation }),
    getPending: () => ipc.safeInvoke('app:get-pending-learning-session'),
    onRequested: (callback: (reference: LearningLiveSessionReference) => void) =>
      ipc.safeOn('app:learning-session', (_event: unknown, reference: LearningLiveSessionReference) => callback(reference)),
  });
}
