import { EventEmitter } from 'node:events';
import { afterEach, expect, it, vi } from 'vitest';
import { ipcMain } from 'electron';
import { initializeAgentActivity } from '../agent-activity';
import type { AgentHarness } from '../agent-runtime/service';
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import type { AgentRun } from '../../src/shared/agent-runtime';
const view = vi.hoisted(() => ({ window: null, show: vi.fn(), hide: vi.fn(), minimize: vi.fn(), destroy: vi.fn() }));
vi.mock('../agent-activity/window', () => ({ ActivityWindow: class { constructor() { return view; } } }));
vi.mock('electron', async importOriginal => {
  const original = await importOriginal<Record<string, unknown>>();
  return { ...original, app: { once: vi.fn(), off: vi.fn() } };
});
afterEach(() => vi.clearAllMocks());
it('restringe publicadores al marco principal y limpia al cambiar de usuario', () => {
  const mainFrame = {}; const webContents = { mainFrame, send: vi.fn() };
  const parent = { webContents, isDestroyed: () => false } as unknown as BrowserWindow;
  let user: string | null = 'uno'; let authChanged!: () => void;
  let runs: AgentRun[] = [];
  const harness = Object.assign(new EventEmitter(), { snapshot: () => runs }) as unknown as AgentHarness;
  const close = initializeAgentActivity({ getWindow: () => parent, getUserId: () => user, harness, onAuthChange: listener => { authChanged = listener; return vi.fn(); } });
  const invoke = (name: string, payload?: unknown, event = { sender: webContents, senderFrame: mainFrame }) => {
    const handler = vi.mocked(ipcMain.handle).mock.calls.find(([channel]) => channel === `agent-activity:${name}`)![1];
    return handler(event as unknown as IpcMainInvokeEvent, payload);
  };
  const activity = { id: crypto.randomUUID(), sequence: 1, surface: 'chat', kind: 'document', status: 'running', durationMs: 0, agents: [{ role: 'contenido', status: 'running' }] };
  try {
    expect(invoke('publish', { ownerId: 'uno', activity }, { sender: webContents, senderFrame: {} }).success).toBe(false);
    expect(invoke('publish', { ownerId: 'otro', activity }).success).toBe(false);
    expect(invoke('publish', { ownerId: 'uno', activity }).success).toBe(true);
    expect(view.show).toHaveBeenCalledTimes(1);
    expect(invoke('snapshot').data).toHaveLength(1);
    user = 'dos'; authChanged(); expect(view.destroy).toHaveBeenCalled();
    expect(invoke('snapshot').data).toEqual([]);
    expect(invoke('publish', { ownerId: 'uno', activity }).success).toBe(false);
    invoke('publish', { ownerId: 'dos', activity: { ...activity, sequence: 2 } });
    expect(invoke('snapshot').data).toEqual([]);
    runs = [{ id: crypto.randomUUID(), scope: { userId: 'dos', organizationId: null }, status: 'running', steps: [{ role: 'acuerdos', status: 'running' }], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as AgentRun];
    view.show.mockImplementationOnce(() => { throw new Error('ventana no disponible'); });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try { expect(() => harness.emit('changed')).not.toThrow(); } finally { warn.mockRestore(); }
    expect(invoke('snapshot').data[0].status).toBe('running');
    runs = []; harness.emit('changed');
    expect(invoke('snapshot').data[0].status).toBe('cancelled');
    user = null; expect(invoke('control', 'show').success).toBe(false);
  } finally { close(); }
});
