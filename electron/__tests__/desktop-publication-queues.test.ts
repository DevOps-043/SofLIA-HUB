import { EventEmitter } from 'node:events';
import { AsyncLocalStorage } from 'node:async_hooks';
import { describe, expect, it, vi } from 'vitest';
import { attachBrowserWebRuntime } from '../browser-web/service-runtime';
import { attachBrowserWebLifecycle } from '../browser-web/service-lifecycle';
import type { BrowserWebConstructor } from '../browser-web/service-types';
import type { BrowserWebService } from '../browser-web-service';
import { executeQueuedTask, processQueue } from '../windows-uia/queue';
import type { WindowsUIAServiceCore } from '../windows-uia/core';
import { processDesktopTaskQueue, type DesktopTaskQueueItem } from '../desktop-agent/task-control';
import { withDesktopTaskPublication } from '../desktop-agent/task-publications';
import { DesktopAgentService } from '../desktop-agent-service';
import { recordDesktopTaskMemory } from '../memory/record-desktop-task';
const storage = new AsyncLocalStorage<string>();
describe('Contexto originario en colas de backends', () => {
  it('BrowserWeb conserva scope de entrada al despachar desde otra continuación', async () => {
    class Fake extends EventEmitter { apiKey = 'ficticia'; status = 'executing'; queue = []; }
    attachBrowserWebRuntime(Fake as unknown as BrowserWebConstructor); attachBrowserWebLifecycle(Fake as unknown as BrowserWebConstructor);
    const service = new Fake() as unknown as BrowserWebService;
    const internal = vi.fn(async () => storage.getStore() ?? 'sin contexto'); service.executeTaskInternal = internal;
    const pending = storage.run('entrada-A', () => service.executeTask('tarea'));
    service.status = 'idle'; storage.run('despachador-B', () => service.processQueue());
    expect(await pending).toBe('entrada-A'); expect(internal).toHaveBeenCalledOnce();
  });
  it('WindowsUIA conserva scope al despachar desde otro trabajo', async () => {
    const internal = vi.fn(async () => storage.getStore() ?? 'sin contexto');
    const service = { apiKey: 'ficticia', status: 'executing', queue: [], executeTaskInternal: internal, emit: vi.fn() } as unknown as WindowsUIAServiceCore;
    const pending = storage.run('entrada-A', () => executeQueuedTask(service, 'tarea'));
    service.status = 'idle'; storage.run('despachador-B', () => processQueue(service)); expect(await pending).toBe('entrada-A');
  });
  it('cancelación en cola no inicia backend al despachar', async () => {
    const controller = new AbortController(), internal = vi.fn(async () => 'resultado');
    const service = { apiKey: 'ficticia', status: 'executing', queue: [], executeTaskInternal: internal, emit: vi.fn() } as unknown as WindowsUIAServiceCore;
    const pending = executeQueuedTask(service, 'tarea', { signal: controller.signal }); const rejected = expect(pending).rejects.toThrow();
    controller.abort(); service.status = 'idle'; processQueue(service); await rejected; expect(internal).not.toHaveBeenCalled();
  });
  it('Desktop usa la continuación guardada y convierte rechazo síncrono sin perder resolución', async () => {
    const resolve = vi.fn(), reject = vi.fn(), fallback = vi.fn();
    const queue: DesktopTaskQueueItem[] = [{ task: 'tarea', enqueuedAt: 0, resolve, reject, execute: () => { throw new Error('revocada'); } }];
    processDesktopTaskQueue({ queue, activeTasks: new Map(), maxConcurrentAgents: 1, executeTask: fallback });
    for (let index = 0; index < 8; index++) await Promise.resolve(); expect(reject).toHaveBeenCalledOnce(); expect(fallback).not.toHaveBeenCalled(); expect(resolve).not.toHaveBeenCalled();
  });
  it('cola BrowserWeb conserva procedencia de aprendizaje con emisor real Desktop', async () => {
    class Browser extends EventEmitter { apiKey = 'ficticia'; status = 'executing'; queue = []; }
    attachBrowserWebRuntime(Browser as unknown as BrowserWebConstructor); attachBrowserWebLifecycle(Browser as unknown as BrowserWebConstructor);
    const browser = new Browser() as unknown as BrowserWebService;
    const desktop = Object.create(DesktopAgentService.prototype) as DesktopAgentService; EventEmitter.call(desktop);
    const saveMessage = vi.fn(); desktop.on('task-completed', payload => recordDesktopTaskMemory({ saveMessage }, payload));
    browser.executeTaskInternal = async () => { desktop.emit('task-completed', { message: 'resultado' }); return 'resultado'; };
    const pending = withDesktopTaskPublication(desktop, 'tarea originaria', undefined, () => browser.executeTask('tarea'));
    browser.status = 'idle'; storage.run('otro despachador', () => browser.processQueue()); await pending;
    expect(saveMessage).toHaveBeenCalledTimes(2); expect(saveMessage.mock.calls[0][0].content).toBe('tarea originaria');
  });
});
