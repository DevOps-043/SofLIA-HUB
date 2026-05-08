export function isDesktopAgentAvailable(): boolean {
  return !!window.desktopAgent;
}

export function getDesktopAgentAPI() {
  if (!window.desktopAgent) {
    throw new Error('Desktop Agent API no disponible.');
  }
  return window.desktopAgent;
}

export function getComputerUseAPI() {
  if (!window.computerUse) {
    throw new Error('Computer Use API no disponible. Asegurate de ejecutar en Electron.');
  }
  return window.computerUse;
}

export function isComputerUseAvailable(): boolean {
  return !!window.computerUse;
}
