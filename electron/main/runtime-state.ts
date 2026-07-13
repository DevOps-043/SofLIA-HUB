import type { BrowserWindow, Tray } from 'electron';
import type { MeetingTriggerPayload } from '../app-protocol';

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
    startInBackground,
    shouldShowInitialWindow: !startInBackground && initialProtocolCommand?.type !== 'meeting-trigger',
    pendingShareLink: initialProtocolCommand?.type === 'share-link' ? initialProtocolCommand.shareLink as string : null,
    pendingMeetingTrigger: initialProtocolCommand?.type === 'meeting-trigger' ? initialProtocolCommand.payload as MeetingTriggerPayload : null,
    currentGeminiApiKey: process.env.VITE_GEMINI_API_KEY || null as string | null,
    waAgent: null as any,
    neuralOrganizer: null as any,
  };
}

export type MainRuntimeState = ReturnType<typeof createRuntimeState>;
