import { ipcMain, type BrowserWindow } from 'electron';
import { trustedAppCaller } from '../ipc/caller-authorization';
import { nativeOpenAIAuthority } from '../openai-runtime/credentials';
import type { OpenAIAuthority, OpenAICaller } from '../openai-runtime/types';
import { getPublicAiErrorMessage } from '../../src/services/gemini-chat/public-error';
import { IMAGE_MAX_PROMPT, type ImageGenerationReply } from '../../src/shared/image-generation';
import { generateProviderImage } from './provider';
import { projectImageResponse } from './response';

type Provider = (key: string, prompt: string, signal: AbortSignal) => Promise<unknown>;
interface Dependencies { bind(caller: OpenAICaller): OpenAIAuthority; provider: Provider }
const defaults: Dependencies = { bind: nativeOpenAIAuthority, provider: generateProviderImage };
const failure = (): ImageGenerationReply => ({ success: false, error: 'No pude generar la imagen en este momento. Intenta de nuevo.' });

/** Plazas físicas compartidas: no se liberan mientras el proveedor siga activo. */
export function registerImageGenerationHandler(windows: () => (BrowserWindow | null)[], deps: Dependencies = defaults): void {
  let active = 0;
  ipcMain.handle('ai:image-generation', async (event, ...args: unknown[]): Promise<ImageGenerationReply> => {
    const caller = trustedAppCaller(event, windows);
    let authority: OpenAIAuthority | undefined;
    let onAbort: (() => void) | undefined;
    try {
      caller.assert();
      if (args.length !== 1 || typeof args[0] !== 'string' || !args[0].trim() || args[0].length > IMAGE_MAX_PROMPT || active >= 4) return failure();
      const prompt = args[0];
      authority = deps.bind(caller); authority.assert();
      const signal = AbortSignal.any([authority.signal, AbortSignal.timeout(120_000)]);
      if (signal.aborted) return failure();
      active += 1;
      const bound = authority;
      const work = (async () => {
        const key = await bound.key(signal); bound.assert(); if (signal.aborted) throw new Error('Solicitud cancelada.');
        const response = await deps.provider(key, prompt, signal); bound.assert(); if (signal.aborted) throw new Error('Solicitud cancelada.');
        return projectImageResponse(response);
      })();
      void work.finally(() => { active -= 1; }).catch(() => {});
      const aborted = new Promise<never>((_resolve, reject) => {
        onAbort = () => reject(new Error('Solicitud cancelada.'));
        signal.addEventListener('abort', onAbort, { once: true });
        if (signal.aborted) onAbort();
      });
      try { const result = await Promise.race([work, aborted]); bound.assert(); return result; }
      finally { if (onAbort) signal.removeEventListener('abort', onAbort); }
    } catch (error) {
      return { success: false, error: getPublicAiErrorMessage(error, { generic: 'No pude generar la imagen en este momento. Intenta de nuevo.' }) };
    } finally {
      if (authority) authority.dispose(); else caller.dispose();
    }
  });
}
