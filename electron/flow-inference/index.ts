import { ipcMain, type BrowserWindow } from 'electron';
import { trustedAppCaller } from '../ipc/caller-authorization';
import { nativeOpenAIAuthority } from '../openai-runtime/credentials';
import type { OpenAIAuthority, OpenAICaller } from '../openai-runtime/types';
import type { NativeFlowReply, NativeFlowRequest } from '../../src/shared/native-flow';
import { validateFlowRequest } from './contract';
import { generateFlow } from './provider';

type Provider = (key: string, request: NativeFlowRequest, signal: AbortSignal) => Promise<string>;
interface Dependencies { bind(caller: OpenAICaller): OpenAIAuthority; provider: Provider }
const defaults: Dependencies = { bind: nativeOpenAIAuthority, provider: generateFlow };
const failure = (): Extract<NativeFlowReply, { success: false }> => ({ success: false, error: 'No se pudo completar la solicitud de Flow. Intenta de nuevo.' });
export function registerFlowInferenceHandler(windows: () => (BrowserWindow | null)[], deps: Dependencies = defaults): void {
  let active = 0;
  ipcMain.handle('ai:flow-inference', async (event, ...args: unknown[]): Promise<NativeFlowReply> => {
    const caller = trustedAppCaller(event, windows); let authority: OpenAIAuthority | undefined;
    try {
      caller.assert(); if (args.length !== 1 || active >= 4) return failure();
      const request = validateFlowRequest(args[0]); authority = deps.bind(caller); authority.assert();
      const signal = AbortSignal.any([authority.signal, AbortSignal.timeout(120_000)]); if (signal.aborted) return failure();
      const bound = authority; active += 1;
      const work = (async () => {
        const key = await bound.key(signal); bound.assert(); if (signal.aborted) throw new Error('Cancelada.');
        const text = await deps.provider(key, request, signal); bound.assert(); if (signal.aborted || typeof text !== 'string' || text.length > 200_000) throw new Error('Respuesta no válida.');
        return { success: true as const, text };
      })();
      void work.finally(() => { active -= 1; }).catch(() => {});
      let onAbort!: () => void;
      const aborted = new Promise<never>((_resolve, reject) => { onAbort = () => reject(new Error('Cancelada.')); signal.addEventListener('abort', onAbort, { once: true }); if (signal.aborted) onAbort(); });
      try { const result = await Promise.race([work, aborted]); bound.assert(); return result; }
      finally { signal.removeEventListener('abort', onAbort); }
    } catch {
      try { caller.assert(); authority?.assert(); } catch { return { ...failure(), code: 'revoked' }; }
      return failure();
    }
    finally { if (authority) authority.dispose(); else caller.dispose(); }
  });
}
