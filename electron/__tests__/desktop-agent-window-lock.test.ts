import { describe, expect, it, vi } from 'vitest';
import {
  ensureTargetWindowLock,
  inferTargetWindowLock,
  windowMatchesLock,
} from '../desktop-agent/window-lock';

describe('Desktop Agent window lock', () => {
  it('WL-001: open_application establece lock de ventana objetivo', () => {
    const lock = inferTargetWindowLock({
      action: 'open_application',
      appName: 'Minecraft Launcher',
      message: 'abrir launcher',
    }, 4);

    expect(lock).toMatchObject({
      title: 'Minecraft Launcher',
      establishedAtStep: 4,
      reason: 'open_application',
    });
  });

  it('WL-002: Chrome activo no coincide con lock de Minecraft Launcher', () => {
    expect(windowMatchesLock(
      { title: 'GenWars - Google Chrome', process: 'chrome.exe' },
      { title: 'Minecraft Launcher', establishedAtStep: 1, reason: 'open_application' },
    )).toBe(false);
  });

  it('WL-003: si la ventana activa no coincide, re-enfoca el lock antes de capturar', async () => {
    const focusWindow = vi.fn(async () => true);
    const delay = vi.fn(async () => {});
    await ensureTargetWindowLock({
      targetWindowLock: { title: 'Minecraft Launcher', establishedAtStep: 1, reason: 'focus_window' },
      getActiveWindow: vi.fn(async () => ({ title: 'Google Chrome', process: 'chrome.exe' })),
      focusWindow,
      delay,
    });

    expect(focusWindow).toHaveBeenCalledWith('Minecraft Launcher');
    expect(delay).toHaveBeenCalledWith(350);
  });

  it('WL-004: ventana activa DESCONOCIDA (null) no re-enfoca a ciegas (evita churn)', async () => {
    const focusWindow = vi.fn(async () => true);
    await ensureTargetWindowLock({
      targetWindowLock: { title: 'Minecraft Launcher', establishedAtStep: 1, reason: 'focus_window' },
      getActiveWindow: vi.fn(async () => null),
      focusWindow,
      delay: vi.fn(async () => {}),
      currentStep: 5,
    });
    expect(focusWindow).not.toHaveBeenCalled();
  });

  it('WL-005: cooldown evita re-enfocar en pasos consecutivos', async () => {
    const focusWindow = vi.fn(async () => true);
    const getActiveWindow = vi.fn(async () => ({ title: 'Google Chrome', process: 'chrome.exe' }));
    const service: any = {
      targetWindowLock: { title: 'Minecraft Launcher', establishedAtStep: 1, reason: 'focus_window' },
      getActiveWindow,
      focusWindow,
      delay: vi.fn(async () => {}),
      currentStep: 5,
      lastWindowRefocusStep: -100,
      refocusCooldownSteps: 2,
    };

    // Paso 5: mismatch confirmado -> re-enfoca y registra el paso.
    await ensureTargetWindowLock(service);
    expect(focusWindow).toHaveBeenCalledTimes(1);
    expect(service.lastWindowRefocusStep).toBe(5);

    // Paso 6: dentro del cooldown -> NO re-enfoca (ni siquiera consulta la ventana).
    service.currentStep = 6;
    await ensureTargetWindowLock(service);
    expect(focusWindow).toHaveBeenCalledTimes(1);

    // Paso 7: cooldown cumplido -> re-enfoca de nuevo.
    service.currentStep = 7;
    await ensureTargetWindowLock(service);
    expect(focusWindow).toHaveBeenCalledTimes(2);
  });
});
