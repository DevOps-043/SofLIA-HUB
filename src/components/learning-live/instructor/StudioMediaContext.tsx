import { createContext, useContext } from 'react';
import type { useStudioMedia } from './useStudioMedia';
import type { ReactNode } from 'react';
import type { StudioCallControls, StudioCaption } from '../../../shared/studio-call';
export type StudioMediaRuntime = ReturnType<typeof useStudioMedia> & { zoomConnected: boolean; zoomPending: boolean; connectZoom: () => void; zoomStage: ReactNode; zoomMic: boolean; zoomCamera: boolean; zoomSharing: boolean; stopZoomShare: () => void; muteZoom: () => void; toggleZoomCamera?: () => void; callControls?: StudioCallControls; caption?: StudioCaption | null; setCaptions?: (enabled: boolean) => void };
export const StudioMediaContext = createContext<StudioMediaRuntime | null>(null);
export const useStudioMediaRuntime = () => useContext(StudioMediaContext);
