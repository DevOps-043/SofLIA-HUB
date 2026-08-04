export interface ChatSpace {
  name: string;
  displayName: string;
  type: string;
  spaceThreadingState?: string;
  spaceType?: string;
  spaceUri?: string;
  lastActiveTime?: string;
  singleUserBotDm?: boolean;
  joinedDirectHumanUserCount?: number;
}

declare global {
  interface Window {
    gchat?: {
      listSpaces: () => Promise<{ success: boolean; spaces?: ChatSpace[]; error?: string }>;
      getMessages: (spaceName: string, maxResults?: number) => Promise<{ success: boolean; messages?: unknown[]; error?: string }>;
      sendMessage: (spaceName: string, text: string, threadName?: string) => Promise<{ success: boolean; messageName?: string; error?: string }>;
      addReaction: (messageName: string, emoji: string) => Promise<{ success: boolean; error?: string }>;
      getMembers: (spaceName: string) => Promise<{ success: boolean; members?: unknown[]; error?: string }>;
    };
  }
}

function getAPI() {
  if (!window.gchat) {
    throw new Error('Google Chat API no disponible. Ejecuta SofLIA dentro de Electron.');
  }
  return window.gchat;
}

export function isGChatAvailable(): boolean {
  return !!window.gchat;
}

export async function listGChatSpaces() {
  return getAPI().listSpaces();
}
