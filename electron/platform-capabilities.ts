export type DesktopSessionKind =
  | 'windows'
  | 'macos'
  | 'linux-x11'
  | 'linux-wayland'
  | 'linux-headless'
  | 'unsupported';

export type PlatformCapabilities = {
  platform: NodeJS.Platform;
  desktopSession: DesktopSessionKind;
  screenshots: boolean;
  activeWindow: boolean;
  guiAutomation: boolean;
  windowControls: boolean;
  powerControls: boolean;
  volumeControls: boolean;
  wifiControls: boolean;
  backgroundHost: boolean;
  updater: boolean;
  windowsUIA: boolean;
  linuxXdotool: boolean;
  unsupportedReason?: string;
};

const WAYLAND_DESKTOP_MESSAGE =
  'La automatizacion visual en Linux requiere una sesion X11 con xdotool. Wayland no permite controlar mouse/teclado de forma portable.';
const HEADLESS_DESKTOP_MESSAGE =
  'La automatizacion visual en Linux requiere una sesion grafica X11 activa y xdotool instalado.';
const UNSUPPORTED_DESKTOP_MESSAGE = 'Esta funcion de escritorio no esta soportada en esta plataforma.';

export function detectPlatformCapabilities(
  platform: NodeJS.Platform = process.platform,
  env: Record<string, string | undefined> = process.env,
): PlatformCapabilities {
  const desktopSession = detectDesktopSession(platform, env);
  const isWindows = platform === 'win32';
  const isMac = platform === 'darwin';
  const isLinux = platform === 'linux';
  const isLinuxX11 = desktopSession === 'linux-x11';
  const isSupportedDesktop = isWindows || isMac || isLinux;
  const unsupportedReason = getUnsupportedDesktopReason(desktopSession);

  return {
    platform,
    desktopSession,
    screenshots: isSupportedDesktop,
    activeWindow: isWindows || isMac || isLinuxX11,
    guiAutomation: isWindows || isLinuxX11,
    windowControls: isWindows || isLinuxX11,
    powerControls: isWindows || isMac || isLinux,
    volumeControls: isWindows || isMac || isLinux,
    wifiControls: isWindows || isLinux,
    backgroundHost: isWindows || isLinux,
    updater: isWindows || isMac || isLinux,
    windowsUIA: isWindows,
    linuxXdotool: isLinuxX11,
    unsupportedReason,
  };
}

export function detectDesktopSession(
  platform: NodeJS.Platform = process.platform,
  env: Record<string, string | undefined> = process.env,
): DesktopSessionKind {
  if (platform === 'win32') return 'windows';
  if (platform === 'darwin') return 'macos';
  if (platform !== 'linux') return 'unsupported';

  const sessionType = String(env.XDG_SESSION_TYPE || '').toLowerCase();
  const hasWayland = Boolean(env.WAYLAND_DISPLAY) || sessionType === 'wayland';
  if (hasWayland) return 'linux-wayland';
  if (env.DISPLAY) return 'linux-x11';
  return 'linux-headless';
}

export function assertGuiAutomationSupported(
  capabilities: PlatformCapabilities = detectPlatformCapabilities(),
): void {
  if (capabilities.guiAutomation) return;
  throw new Error(capabilities.unsupportedReason || UNSUPPORTED_DESKTOP_MESSAGE);
}

export function assertWindowsUIASupported(
  capabilities: PlatformCapabilities = detectPlatformCapabilities(),
): void {
  if (capabilities.windowsUIA) return;
  throw new Error('Windows UI Automation solo esta disponible en Windows. En Linux usa browser_web o desktop_visual con X11 + xdotool.');
}

export function getUnsupportedDesktopReason(session: DesktopSessionKind): string | undefined {
  if (session === 'linux-wayland') return WAYLAND_DESKTOP_MESSAGE;
  if (session === 'linux-headless') return HEADLESS_DESKTOP_MESSAGE;
  if (session === 'unsupported') return UNSUPPORTED_DESKTOP_MESSAGE;
  return undefined;
}
