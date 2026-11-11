import { describe, expect, it, vi } from 'vitest';
import type { Page } from 'playwright-core';
import { executeBrowserAction } from '../browser-web/action-executor';
import { executeAction } from '../windows-uia/action-executor';
import { attachBrowserWebEngine } from '../browser-web/service-engine';
import { decideNextAction } from '../windows-uia/planner';
import type { BrowserWebService } from '../browser-web-service';
import type { BrowserWebConstructor } from '../browser-web/service-types';
import type { WindowsUIAServiceCore } from '../windows-uia/core';
import type { WindowsUIASnapshot } from '../windows-uia/types';
import type { BrowserPageSnapshot } from '../browser-web/types';

const inference = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock('../ai-provider/text', () => ({ generateSessionText: inference.generate }));

function browserFixture() {
  const abort = new AbortController();
  const locator = { first: vi.fn(), scrollIntoViewIfNeeded: vi.fn(async () => {}), waitFor: vi.fn(async () => {}), click: vi.fn(async () => {}), evaluate: vi.fn().mockResolvedValue(false), fill: vi.fn(async () => {}), selectOption: vi.fn().mockResolvedValue(['opción']) };
  locator.first.mockReturnValue(locator);
  const page = { locator: vi.fn(() => locator), keyboard: { press: vi.fn(async () => {}), type: vi.fn(async () => {}) }, mouse: { wheel: vi.fn(async () => {}) }, goto: vi.fn(async () => null), waitForLoadState: vi.fn(async () => {}), waitForTimeout: vi.fn(async () => {}) };
  return { abort, locator, page, realPage: page as unknown as Page };
}
const uiaSnapshot: WindowsUIASnapshot = { currentWindowTitle: 'Prueba', currentProcess: 'prueba', windows: [], elements: [{ id: 1, name: 'Prueba', controlType: 'Button', isEnabled: true, boundingRect: { x: 0, y: 0, width: 10, height: 10 } }], screenshotBase64: '', signature: 'prueba' };
function uiaFixture() {
  const abort = new AbortController();
  const desktop = { mouseClick: vi.fn(async () => {}), keyboardType: vi.fn(async () => {}), keyboardKey: vi.fn(async () => {}), mouseScroll: vi.fn(async () => {}), focusWindow: vi.fn(async () => {}), mapDesktopPointToScreenshotPoint: () => ({ x: 5, y: 5 }) };
  return { abort, desktop, core: { desktopAgent: desktop } as unknown as WindowsUIAServiceCore };
}
describe('Efectos compuestos con cancelación', () => {
  it('no hace click después de esperar visibilidad revocada', async () => {
    const f = browserFixture(); f.locator.waitFor.mockImplementationOnce(async () => { f.abort.abort(); });
    await expect(executeBrowserAction(f.realPage, { action: 'click_ref', ref: 'r1', message: '' }, f.abort.signal)).rejects.toThrow('cancelada'); expect(f.locator.click).not.toHaveBeenCalled();
  });
  it('no usa click DOM alternativo tras revocar el click anterior', async () => {
    const f = browserFixture(); f.locator.click.mockImplementationOnce(async () => { f.abort.abort(); throw new Error('ficticio'); });
    await expect(executeBrowserAction(f.realPage, { action: 'click_ref', ref: 'r1', message: '' }, f.abort.signal)).rejects.toThrow('cancelada'); expect(f.locator.evaluate).not.toHaveBeenCalled();
  });
  it('no escribe tras revocar Control+A en contenteditable', async () => {
    const f = browserFixture(); f.locator.evaluate.mockResolvedValueOnce('div').mockResolvedValueOnce(true); f.page.keyboard.press.mockImplementationOnce(async () => { f.abort.abort(); });
    await expect(executeBrowserAction(f.realPage, { action: 'fill_ref', ref: 'r1', text: 'prueba', message: '' }, f.abort.signal)).rejects.toThrow('cancelada'); expect(f.page.keyboard.type).not.toHaveBeenCalled();
  });
  it('no reintenta fill por teclado si el fill fue revocado', async () => {
    const f = browserFixture(); f.locator.evaluate.mockResolvedValueOnce('input').mockResolvedValueOnce(false); f.locator.fill.mockImplementationOnce(async () => { f.abort.abort(); throw new Error('ficticio'); });
    await expect(executeBrowserAction(f.realPage, { action: 'fill_ref', ref: 'r1', text: 'prueba', message: '' }, f.abort.signal)).rejects.toThrow('cancelada'); expect(f.locator.click).not.toHaveBeenCalled(); expect(f.page.keyboard.type).not.toHaveBeenCalled();
  });
  it('no prueba otra opción de select tras cancelar', async () => {
    const f = browserFixture(); f.locator.evaluate.mockResolvedValueOnce('select').mockResolvedValueOnce(false); f.locator.selectOption.mockImplementationOnce(async () => { f.abort.abort(); throw new Error('ficticio'); });
    await expect(executeBrowserAction(f.realPage, { action: 'fill_ref', ref: 'r1', text: 'prueba', message: '' }, f.abort.signal)).rejects.toThrow('cancelada'); expect(f.locator.selectOption).toHaveBeenCalledOnce();
  });
  it('conserva fallback de select en una tarea vigente', async () => {
    const f = browserFixture(); f.locator.evaluate.mockResolvedValueOnce('select').mockResolvedValueOnce(false); f.locator.selectOption.mockRejectedValueOnce(new Error('etiqueta ausente'));
    await executeBrowserAction(f.realPage, { action: 'fill_ref', ref: 'r1', text: 'prueba', message: '' }, f.abort.signal); expect(f.locator.selectOption).toHaveBeenCalledTimes(2);
  });
  it('conserva fill legítimo sin teclado alternativo', async () => {
    const f = browserFixture(); f.locator.evaluate.mockResolvedValueOnce('input').mockResolvedValueOnce(false);
    await executeBrowserAction(f.realPage, { action: 'fill_ref', ref: 'r1', text: 'prueba', message: '' }, f.abort.signal); expect(f.locator.fill).toHaveBeenCalledOnce(); expect(f.page.keyboard.type).not.toHaveBeenCalled();
  });
  it('no inicia espera posterior si goto fue revocado', async () => {
    const f = browserFixture(); f.page.goto.mockImplementationOnce(async () => { f.abort.abort(); return null; });
    await expect(executeBrowserAction(f.realPage, { action: 'goto', url: 'https://example.test', message: '' }, f.abort.signal)).rejects.toThrow('cancelada'); expect(f.page.waitForLoadState).not.toHaveBeenCalled();
  });
  it.each(['press_key', 'scroll'] as const)('niega %s ya revocada', async action => {
    const f = browserFixture(); f.abort.abort(); await expect(executeBrowserAction(f.realPage, { action, key: 'Enter', message: '' }, f.abort.signal)).rejects.toThrow('cancelada'); expect(f.page.keyboard.press).not.toHaveBeenCalled(); expect(f.page.mouse.wheel).not.toHaveBeenCalled();
  });
  it('UIA no escribe tras revocar el click inicial', async () => {
    const f = uiaFixture(); f.desktop.mouseClick.mockImplementationOnce(async () => { f.abort.abort(); });
    await expect(executeAction(f.core, { action: 'type_in_element', elementId: 1, text: 'prueba', message: '' }, uiaSnapshot, f.abort.signal)).rejects.toThrow('cancelada'); expect(f.desktop.keyboardType).not.toHaveBeenCalled();
  });
  it('UIA conserva tecla legítima', async () => {
    const f = uiaFixture(); await executeAction(f.core, { action: 'key', key: 'enter', message: '' }, uiaSnapshot, f.abort.signal); expect(f.desktop.keyboardKey).toHaveBeenCalledWith('enter');
  });
  it('UIA no inicia entrada ya revocada', async () => {
    const f = uiaFixture(); f.abort.abort(); await expect(executeAction(f.core, { action: 'type_in_element', elementId: 1, text: 'prueba', message: '' }, uiaSnapshot, f.abort.signal)).rejects.toThrow('cancelada'); expect(f.desktop.mouseClick).not.toHaveBeenCalled(); expect(f.desktop.keyboardType).not.toHaveBeenCalled();
  });
});

describe('Modelos conservan cancelación sin fallback', () => {
  const browserSnapshot: BrowserPageSnapshot = { url: 'https://example.test', title: 'Prueba', textExcerpt: '', elements: [], screenshotBase64: '', scrollY: 0, activeRef: '', signature: '' };
  for (const backend of ['web', 'uia'] as const) {
    it(`${backend} no consulta modelo alternativo después de revocar`, async () => {
      const abort = new AbortController();
      const generate = inference.generate.mockImplementationOnce(async () => { abort.abort(); throw new Error('cancelación ficticia'); });
      class Fake {}
      attachBrowserWebEngine(Fake as unknown as BrowserWebConstructor);
      const pending = backend === 'web'
        ? (new Fake() as unknown as BrowserWebService).decideNextAction('tarea', browserSnapshot, [], abort.signal)
        : decideNextAction({} as WindowsUIAServiceCore, 'tarea', uiaSnapshot, [], abort.signal);
      await expect(pending).rejects.toThrow('cancelada'); expect(generate.mock.lastCall?.[1]).toMatchObject({ signal: abort.signal });
    });
  }
});
