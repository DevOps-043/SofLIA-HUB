import { EventEmitter } from 'node:events';
import { expect, it, vi, type Mock } from 'vitest';
import { ActivityWindow } from '../agent-activity/window';
import type { BrowserWindow } from 'electron';
type TestWindow = { loadURL: Mock; showInactive: Mock; destroy: Mock; emit(name: string, event: unknown): boolean };
const state = vi.hoisted(() => ({ options: {} as { webPreferences?: unknown }, win: null as unknown as TestWindow, ready: null as null | (() => void) }));
vi.mock('electron', () => ({
  screen: { getDisplayMatching: () => ({ workArea: { x: 0, y: 0, width: 1000, height: 800 } }) },
  BrowserWindow: class extends EventEmitter {
    webContents = { setWindowOpenHandler: vi.fn(), on: vi.fn() };
    showInactive = vi.fn(); hide = vi.fn(); minimize = vi.fn(); destroy = vi.fn(); restore = vi.fn();
    isDestroyed = () => false; isMinimized = () => false;
    loadURL = vi.fn(() => new Promise<void>(resolve => { state.ready = resolve; }));
    constructor(options: { webPreferences?: unknown }) { super(); state.options = options; state.win = this; }
  },
}));
it('oculta sin cancelar y no reaparece al terminar una carga pendiente', async () => {
  const parent = { isDestroyed: () => false, getBounds: () => ({}), webContents: { getURL: () => 'http://localhost:5173/?session=privada' } } as unknown as BrowserWindow;
  const view = new ActivityWindow(() => parent); view.show();
  expect(state.options.webPreferences).toMatchObject({ sandbox: true, contextIsolation: true, nodeIntegration: false, additionalArguments: ['--agent-activity-window'] });
  expect(state.win.loadURL).toHaveBeenCalledWith('http://localhost:5173/?view=agent-activity');
  view.hide(); state.ready!(); await Promise.resolve();
  expect(state.win.showInactive).not.toHaveBeenCalled();
  view.show(); expect(state.win.showInactive).toHaveBeenCalledTimes(1);
  const event = { preventDefault: vi.fn() }; state.win.emit('close', event);
  expect(event.preventDefault).toHaveBeenCalled(); expect(state.win.destroy).not.toHaveBeenCalled();
  view.destroy(); expect(state.win.destroy).toHaveBeenCalled(); expect(view.window).toBeNull();
});
