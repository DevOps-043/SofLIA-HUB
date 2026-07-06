import type { DesktopActionPayload, TargetWindowLock } from '../desktop-agent-types';

export type ActiveWindowInfo = { title: string; process: string } | null;

const LOCKING_ACTIONS = new Set(['open_application', 'focus_window', 'wait_for_window']);

export function inferTargetWindowLock(action: DesktopActionPayload, currentStep: number): TargetWindowLock | null {
  if (!LOCKING_ACTIONS.has(action.action)) return null;
  const title = getLockTitle(action);
  if (!title) return null;
  return {
    title,
    establishedAtStep: currentStep,
    reason: action.action,
  };
}

export function windowMatchesLock(active: ActiveWindowInfo, lock: TargetWindowLock | null): boolean {
  if (!lock) return true;
  if (!active) return false;
  const expected = normalize(lock.title);
  if (!expected) return true;
  const title = normalize(active.title);
  const processName = normalize(active.process);
  return Boolean((title && (title.includes(expected) || expected.includes(title)))
    || (processName && (processName.includes(expected) || expected.includes(processName))));
}

const DEFAULT_REFOCUS_COOLDOWN_STEPS = 2;

export async function ensureTargetWindowLock(service: {
  targetWindowLock?: TargetWindowLock | null;
  getActiveWindow: () => Promise<ActiveWindowInfo>;
  focusWindow: (title: string) => Promise<boolean>;
  delay: (ms: number) => Promise<void>;
  currentStep?: number;
  lastWindowRefocusStep?: number;
  refocusCooldownSteps?: number;
}): Promise<void> {
  const lock = service.targetWindowLock;
  if (!lock) return;

  // Cooldown: tras re-enfocar, no volver a intentar durante unos pasos. Evita el
  // "re-focus en cada paso" que confundia al modelo (le decia que la ventana no
  // estaba visible). Se comprueba ANTES de consultar la ventana activa para
  // ahorrar la llamada.
  const step = service.currentStep ?? 0;
  const cooldown = service.refocusCooldownSteps ?? DEFAULT_REFOCUS_COOLDOWN_STEPS;
  const last = typeof service.lastWindowRefocusStep === 'number' ? service.lastWindowRefocusStep : -Infinity;
  if (step - last < cooldown) return;

  let active: ActiveWindowInfo = null;
  try {
    active = await service.getActiveWindow();
  } catch {
    active = null;
  }

  // Activa DESCONOCIDA (no se pudo determinar): no re-enfocar a ciegas. Solo se
  // re-enfoca ante un mismatch CONFIRMADO (activa conocida y distinta al lock).
  if (!active) return;
  if (windowMatchesLock(active, lock)) return;

  console.warn('[DesktopAgent] Window lock: ventana activa fuera de objetivo:', JSON.stringify({
    objetivo: lock.title,
    activa: active,
  }));
  const focused = await service.focusWindow(lock.title);
  service.lastWindowRefocusStep = step;
  console.log('[DesktopAgent] Window lock: re-focus', JSON.stringify({
    objetivo: lock.title,
    ok: focused,
  }));
  if (focused) await service.delay(350);
}

function getLockTitle(action: DesktopActionPayload): string | null {
  if (action.action === 'open_application') return clean(action.appName);
  if (action.action === 'focus_window' || action.action === 'wait_for_window') return clean(action.windowTitle);
  return null;
}

function clean(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalize(value: string | undefined): string {
  return (value || '')
    .toLowerCase()
    .replace(/\.exe$/i, '')
    .replace(/[^a-z0-9 ]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
