import { createContext, useContext } from 'react';
import type { useStudioMedia } from './useStudioMedia';
import type { ReactNode } from 'react';
export type StudioMediaRuntime = ReturnType<typeof useStudioMedia> & { zoomConnected: boolean; zoomPending: boolean; connectZoom: () => void; zoomStage: ReactNode; zoomMic: boolean; zoomCamera: boolean; zoomSharing: boolean; stopZoomShare: () => void; muteZoom: () => void };
export const StudioMediaContext = createContext<StudioMediaRuntime | null>(null);
export const useStudioMediaRuntime = () => useContext(StudioMediaContext);
