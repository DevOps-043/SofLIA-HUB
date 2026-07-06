import { describe, expect, it } from 'vitest';
import {
  assertGuiAutomationSupported,
  assertWindowsUIASupported,
  detectDesktopSession,
  detectPlatformCapabilities,
} from '../platform-capabilities';

describe('platform capabilities', () => {
  it('LINUX-001: detects Linux X11 as xdotool-capable GUI automation', () => {
    const capabilities = detectPlatformCapabilities('linux', { DISPLAY: ':0', XDG_SESSION_TYPE: 'x11' });

    expect(capabilities.desktopSession).toBe('linux-x11');
    expect(capabilities.guiAutomation).toBe(true);
    expect(capabilities.linuxXdotool).toBe(true);
    expect(capabilities.windowsUIA).toBe(false);
  });

  it('LINUX-002: detects Wayland and blocks portable GUI automation', () => {
    const capabilities = detectPlatformCapabilities('linux', { WAYLAND_DISPLAY: 'wayland-0', DISPLAY: ':0' });

    expect(capabilities.desktopSession).toBe('linux-wayland');
    expect(capabilities.guiAutomation).toBe(false);
    expect(() => assertGuiAutomationSupported(capabilities)).toThrow(/Wayland/i);
  });

  it('LINUX-003: detects headless Linux and explains missing X11 session', () => {
    expect(detectDesktopSession('linux', {})).toBe('linux-headless');
    expect(() => assertGuiAutomationSupported(detectPlatformCapabilities('linux', {}))).toThrow(/X11/i);
  });

  it('LINUX-004: Windows UIA is Windows-only', () => {
    expect(() => assertWindowsUIASupported(detectPlatformCapabilities('linux', { DISPLAY: ':0' }))).toThrow(/Windows UI Automation/i);
    expect(() => assertWindowsUIASupported(detectPlatformCapabilities('win32', {}))).not.toThrow();
  });
});

