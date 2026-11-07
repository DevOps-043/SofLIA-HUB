import { ipcMain, type BrowserWindow } from 'electron';
import { trustedAppCaller } from '../ipc/caller-authorization';
import { nativeOpenAIAuthority } from './credentials';
import { nativeOpenAIProvider } from './provider';
import { OpenAIJobService } from './job-service';
import { OpenAIScopeRegistry } from './scope-registry';
import { openaiFailure, openaiRuntimeId, validateOpenAIRequest } from '../../src/shared/openai-runtime';
import type { OpenAIAuthority, OpenAICaller, OpenAIProvider, OpenAIScope } from './types';

interface Dependencies { bind(caller: OpenAICaller): OpenAIAuthority; provider: OpenAIProvider }
export function registerOpenAIRuntime(windows: () => (BrowserWindow | null)[], deps: Dependencies = { bind: nativeOpenAIAuthority, provider: nativeOpenAIProvider }): void {
  const jobs = new OpenAIJobService(deps.provider);
  const scopes = new OpenAIScopeRegistry(deps.bind, scope => jobs.cancelScope(scope));
  ipcMain.handle('ai:openai-open', (event, ...args: unknown[]) => {
    const caller = trustedAppCaller(event, windows); let retained = false;
    try {
      caller.assert(); if (args.length) return openaiFailure('INVALID_PAYLOAD');
      const opened = scopes.open(event.sender, event.senderFrame, caller); retained = opened.retained;
      caller.assert(); return { success: true, scopeId: opened.scope.id };
    } catch { return openaiFailure('IPC_DENIED'); }
    finally { if (!retained) caller.dispose(); }
  });
  const register = (name: string, count: number, work: (scope: OpenAIScope, args: unknown[]) => unknown | Promise<unknown>) => {
    ipcMain.handle(name, async (event, ...args: unknown[]) => {
      const caller = trustedAppCaller(event, windows); let scope: OpenAIScope | undefined, phase = 'IPC_DENIED';
      try {
        caller.assert(); phase = 'INVALID_PAYLOAD';
        if (args.length !== count) return openaiFailure('INVALID_PAYLOAD');
        const id = openaiRuntimeId(args[0]); phase = 'IPC_DENIED';
        scope = scopes.get(event.sender, event.senderFrame, id, caller.userId);
        phase = 'INVALID_PAYLOAD';
        const result = await work(scope, args.slice(1));
        caller.assert(); scope.authority.assert(); return result;
      } catch {
        try { caller.assert(); scope?.authority.assert(); } catch { phase = 'IPC_DENIED'; }
        return openaiFailure(phase === 'INVALID_PAYLOAD' ? 'INVALID_PAYLOAD' : 'IPC_DENIED');
      }
      finally { caller.dispose(); }
    });
  };
  register('ai:openai-start', 4, (scope, args) => {
    const requestId = openaiRuntimeId(args[0]); const body = validateOpenAIRequest(args[1]);
    const retries = args[2] === undefined ? 2 : args[2];
    if (typeof retries !== 'number' || !Number.isInteger(retries) || retries < 0 || retries > 2) throw new Error('Reintentos no válidos.');
    return jobs.start(scope, requestId, body, retries);
  });
  register('ai:openai-pull', 3, (scope, args) => {
    const requestId = openaiRuntimeId(args[0]), cursor = args[1];
    if (typeof cursor !== 'number' || !Number.isSafeInteger(cursor) || cursor < 0) throw new Error('Cursor no válido.');
    return jobs.pull(scope, requestId, cursor);
  });
  register('ai:openai-cancel', 2, (scope, args) => ({ success: true, cancelled: jobs.cancel(scope, openaiRuntimeId(args[0])) }));
}
