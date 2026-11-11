import type { Locator, Page } from 'playwright-core';
import { assertBackendTaskActive, runBackendTaskStage } from '../desktop-agent/task-cancellation';
import { WAIT_AFTER_ACTION_MS } from './constants';
import { normalizeUrl } from './normalizers';
import type { BrowserActionPayload } from './types';

export async function waitForBrowserPageSettled(page: Page, signal?: AbortSignal): Promise<void> {
  await runBackendTaskStage(signal, () => page.waitForLoadState('domcontentloaded', { timeout: 7000 }).catch(() => {}));
  await runBackendTaskStage(signal, () => page.waitForLoadState('networkidle', { timeout: 1500 }).catch(() => {}));
  await runBackendTaskStage(signal, () => page.waitForTimeout(WAIT_AFTER_ACTION_MS));
}
function locatorForRef(page: Page, ref: string): Locator { return page.locator(`[data-soflia-ref="${ref}"]`).first(); }
async function prepareLocator(page: Page, ref: string, signal?: AbortSignal): Promise<Locator> {
  assertBackendTaskActive(signal);
  const locator = locatorForRef(page, ref);
  await runBackendTaskStage(signal, () => locator.scrollIntoViewIfNeeded().catch(() => {}));
  await runBackendTaskStage(signal, () => locator.waitFor({ state: 'visible', timeout: 7000 }));
  return locator;
}
async function clickRef(page: Page, ref: string, signal?: AbortSignal): Promise<void> {
  const locator = await prepareLocator(page, ref, signal);
  try { await runBackendTaskStage(signal, () => locator.click({ timeout: 7000 })); }
  catch (error: unknown) {
    assertBackendTaskActive(signal);
    const clicked = await runBackendTaskStage(signal, () => locator.evaluate(node => {
      if (node instanceof HTMLElement) { node.click(); return true; }
      return false;
    }).catch(() => false));
    if (!clicked) throw error;
  }
  await waitForBrowserPageSettled(page, signal);
}
async function selectOption(locator: Locator, text: string, signal?: AbortSignal): Promise<void> {
  for (const choice of [{ label: text }, { value: text }, text]) {
    try {
      const selected = await runBackendTaskStage(signal, () => locator.selectOption(choice));
      if (selected.length) return;
    } catch { assertBackendTaskActive(signal); }
  }
  throw new Error('No se pudo seleccionar la opción indicada.');
}
async function typeWithKeyboard(page: Page, locator: Locator, text: string, signal?: AbortSignal): Promise<void> {
  await runBackendTaskStage(signal, () => locator.click({ timeout: 7000 }));
  await runBackendTaskStage(signal, () => page.keyboard.press('Control+A').catch(() => {}));
  await runBackendTaskStage(signal, () => page.keyboard.type(text));
}
async function fillRef(page: Page, ref: string, text: string, signal?: AbortSignal): Promise<void> {
  const locator = await prepareLocator(page, ref, signal);
  const tag = await runBackendTaskStage(signal, () => locator.evaluate(node => node instanceof HTMLElement ? node.tagName.toLowerCase() : '').catch(() => ''));
  const editable = await runBackendTaskStage(signal, () => locator.evaluate(node => node instanceof HTMLElement && node.isContentEditable).catch(() => false));
  if (tag === 'select') await selectOption(locator, text, signal);
  else if (editable) await typeWithKeyboard(page, locator, text, signal);
  else {
    try { await runBackendTaskStage(signal, () => locator.fill(text, { timeout: 7000 })); }
    catch { assertBackendTaskActive(signal); await typeWithKeyboard(page, locator, text, signal); }
  }
  await waitForBrowserPageSettled(page, signal);
}
export async function executeBrowserAction(page: Page, action: BrowserActionPayload, signal?: AbortSignal): Promise<void> {
  assertBackendTaskActive(signal);
  switch (action.action) {
    case 'goto':
      if (!action.url) throw new Error('La accion goto requiere url.');
      await runBackendTaskStage(signal, () => page.goto(normalizeUrl(action.url!), { waitUntil: 'domcontentloaded', timeout: 20000 }));
      return waitForBrowserPageSettled(page, signal);
    case 'click_ref':
      if (!action.ref) throw new Error('La accion click_ref requiere ref.');
      return clickRef(page, action.ref, signal);
    case 'fill_ref':
      if (!action.ref) throw new Error('La accion fill_ref requiere ref.');
      return fillRef(page, action.ref, action.text || '', signal);
    case 'press_key':
      if (!action.key) throw new Error('La accion press_key requiere key.');
      await runBackendTaskStage(signal, () => page.keyboard.press(action.key!));
      return waitForBrowserPageSettled(page, signal);
    case 'scroll': {
      const delta = ((action.direction || 'down') === 'up' ? -800 : 800) * Math.max(1, action.amount || 1);
      await runBackendTaskStage(signal, () => page.mouse.wheel(0, delta));
      return waitForBrowserPageSettled(page, signal);
    }
    case 'wait':
      await runBackendTaskStage(signal, () => page.waitForTimeout(Math.max(500, (action.amount || 1) * 1000)));
      return;
    default: throw new Error(`Accion no soportada por browser_web: ${action.action}`);
  }
}
