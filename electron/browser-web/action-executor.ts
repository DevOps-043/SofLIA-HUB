import { WAIT_AFTER_ACTION_MS } from './constants';
import { normalizeUrl } from './normalizers';
import type { BrowserActionPayload } from './types';
export async function waitForBrowserPageSettled(page: any): Promise<void> {
  await page.waitForLoadState('domcontentloaded', { timeout: 7000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 1500 }).catch(() => {});
  await page.waitForTimeout(WAIT_AFTER_ACTION_MS);
}
function locatorForRef(page: any, ref: string): any {
  return page.locator(`[data-soflia-ref="${ref}"]`).first();
}
async function clickRef(page: any, ref: string): Promise<void> {
  const locator = locatorForRef(page, ref);
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  await locator.waitFor({ state: 'visible', timeout: 7000 });
  try {
    await locator.click({ timeout: 7000 });
  } catch (clickError: any) {
    const fallbackClicked = await locator.evaluate((node: any) => {
      if (node instanceof HTMLElement) {
        node.click();
        return true;
      }
      return false;
    }).catch(() => false);
    if (!fallbackClicked) throw clickError;
  }
  await waitForBrowserPageSettled(page);
}
async function fillRef(page: any, ref: string, text: string): Promise<void> {
  const locator = locatorForRef(page, ref);
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  await locator.waitFor({ state: 'visible', timeout: 7000 });
  const tag = await locator.evaluate((node: any) =>
    node instanceof HTMLElement ? node.tagName.toLowerCase() : '',
  ).catch(() => '');
  const isContentEditable = await locator.evaluate((node: any) =>
    node instanceof HTMLElement ? !!node.isContentEditable : false,
  ).catch(() => false);
  if (tag === 'select') {
    const selected = await locator.selectOption({ label: text }).catch(async () =>
      locator.selectOption({ value: text }).catch(async () => locator.selectOption(text).catch(() => [])),
    );
    if (!Array.isArray(selected) || selected.length === 0) {
      throw new Error(`No se pudo seleccionar "${text}" en el campo ${ref}.`);
    }
  } else if (isContentEditable) {
    await locator.click({ timeout: 7000 });
    await page.keyboard.press('Control+A').catch(() => {});
    await page.keyboard.type(text);
  } else {
    try {
      await locator.fill(text, { timeout: 7000 });
    } catch {
      await locator.click({ timeout: 7000 });
      await page.keyboard.press('Control+A').catch(() => {});
      await page.keyboard.type(text);
    }
  }
  await waitForBrowserPageSettled(page);
}
export async function executeBrowserAction(page: any, action: BrowserActionPayload): Promise<void> {
  switch (action.action) {
    case 'goto':
      if (!action.url) throw new Error('La accion goto requiere url.');
      await page.goto(normalizeUrl(action.url), { waitUntil: 'domcontentloaded', timeout: 20000 });
      await waitForBrowserPageSettled(page);
      return;
    case 'click_ref':
      if (!action.ref) throw new Error('La accion click_ref requiere ref.');
      await clickRef(page, action.ref);
      return;
    case 'fill_ref':
      if (!action.ref) throw new Error('La accion fill_ref requiere ref.');
      await fillRef(page, action.ref, action.text || '');
      return;
    case 'press_key':
      if (!action.key) throw new Error('La accion press_key requiere key.');
      await page.keyboard.press(action.key);
      await waitForBrowserPageSettled(page);
      return;
    case 'scroll': {
      const amount = Math.max(1, action.amount || 1);
      const delta = (action.direction || 'down') === 'up' ? -800 * amount : 800 * amount;
      await page.mouse.wheel(0, delta);
      await waitForBrowserPageSettled(page);
      return;
    }
    case 'wait':
      await page.waitForTimeout(Math.max(500, (action.amount || 1) * 1000));
      return;
    default:
      throw new Error(`Accion no soportada por browser_web: ${action.action}`);
  }
}
