import { createContext, useContext } from 'react';
import type { StudioCommand, StudioSnapshot } from '../../../shared/live-studio.contract';
import type { LearningLiveSessionReference } from '../../../shared/learning-live-session';

export type StudioRuntime = {
  reference?: LearningLiveSessionReference;
  snapshot: StudioSnapshot;
  busy: boolean;
  realtime: string;
  error: string;
  send: (command: StudioCommand) => Promise<boolean>;
  upload: (file: File) => Promise<string>;
  refresh: () => Promise<void>;
  reconnect?: () => Promise<void>;
};
export const StudioRuntimeContext = createContext<StudioRuntime | null>(null);
export const useStudioRuntime = () => useContext(StudioRuntimeContext);
