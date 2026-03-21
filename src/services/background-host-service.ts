declare global {
  interface Window {
    backgroundHost?: {
      getStatus: () => Promise<any>;
      updateConfig: (updates: { enabled?: boolean }) => Promise<any>;
      repair: () => Promise<any>;
    };
  }
}

function getAPI() {
  if (!window.backgroundHost) {
    throw new Error('Background Host API no disponible. Asegurate de ejecutar en Electron.');
  }
  return window.backgroundHost;
}

export async function getBackgroundHostStatus() {
  return getAPI().getStatus();
}

export async function updateBackgroundHostConfig(updates: { enabled?: boolean }) {
  return getAPI().updateConfig(updates);
}

export async function repairBackgroundHost() {
  return getAPI().repair();
}

export function isBackgroundHostAvailable(): boolean {
  return !!window.backgroundHost;
}
