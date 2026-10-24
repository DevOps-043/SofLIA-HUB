import type { BrowserWindow, Tray } from 'electron';
import type { AuthCallbackPayload, MeetingTriggerPayload } from '../app-protocol';
import type { LearningLiveSessionReference } from '../../src/shared/learning-live-session';

const BACKGROUND_LAUNCH_ARG = '--background';

export function createRuntimeState(initialProtocolCommand: any) {
  const startInBackground = process.argv.includes(BACKGROUND_LAUNCH_ARG);
  return {
    win: null as BrowserWindow | null,
    orbWin: null as BrowserWindow | null,
    tray: null as Tray | null,
    isQuitting: false,
    // Wake word pendiente para la ventana orbe (el renderer lo consume por invoke).
    pendingOrbWake: false,
    localVoiceSession: null as import('../voice/session').LocalVoiceSession | null,
    pythonToolsIpc: null as { dispose(): void } | null,
    desktopContextIpc: null as { dispose(): void } | null,
    startInBackground,
    shouldShowInitialWindow: !startInBackground && initialProtocolCommand?.type !== 'meeting-trigger',
    pendingShareLink: initialProtocolCommand?.type === 'share-link' ? initialProtocolCommand.shareLink as string : null,
    pendingMeetingTrigger: initialProtocolCommand?.type === 'meeting-trigger' ? initialProtocolCommand.payload as MeetingTriggerPayload : null,
    pendingLearningSession: initialProtocolCommand?.type === 'learning-session' ? initialProtocolCommand.payload as LearningLiveSessionReference : null,
    // Arranque en frio desde el retorno del inicio federado: el renderer todavia
    // no existe, asi que el resultado espera aqui hasta que lo pida.
    pendingAuthCallback: initialProtocolCommand?.type === 'auth-callback' ? initialProtocolCommand.payload as AuthCallbackPayload : null,
    currentGeminiApiKey: process.env.VITE_GEMINI_API_KEY || null as string | null,
    waAgent: null as any,
    neuralOrganizer: null as any,
  };
}

export type MainRuntimeState = ReturnType<typeof createRuntimeState>;
