import { getHubDbClient } from '../hub-db-client';
import { linkedOpenAIHubUserId } from './session-binding';
import type { OpenAIAuthority, OpenAICaller } from './types';

export class NativeOpenAIKeyMissingError extends Error {
  constructor() { super('No hay una clave OpenAI disponible.'); }
}
type HubClient = ReturnType<typeof getHubDbClient>;
interface CredentialDependencies { client(): HubClient; userId(): string | null; environmentKey(): string | undefined }
const dependencies: CredentialDependencies = { client: getHubDbClient, userId: linkedOpenAIHubUserId, environmentKey: () => process.env.VITE_OPENAI_API_KEY };
const geminiDependencies: CredentialDependencies = { client: getHubDbClient, userId: linkedOpenAIHubUserId, environmentKey: () => process.env.VITE_GEMINI_API_KEY };

/** Sin caché entre proveedores/cuentas ni clave devuelta por IPC. Los sujetos SOFIA/Lia conservan sus contratos. */
function nativeProviderAuthority(caller: OpenAICaller, deps: CredentialDependencies, provider: 'openai' | 'google'): OpenAIAuthority {
  caller.assert();
  const owner = deps.userId(), controller = new AbortController();
  const client = owner ? deps.client() : null;
  let disposed = false;
  const subscription = client?.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || session?.user?.id !== owner) controller.abort();
  }).data.subscription;
  const signal = AbortSignal.any([caller.signal, controller.signal]);
  const assert = () => {
    caller.assert();
    if (disposed || signal.aborted || deps.userId() !== owner) throw new Error('La sesión de credenciales ya no está vigente.');
  };
  const dispose = () => { if (disposed) return; disposed = true; subscription?.unsubscribe(); controller.abort(); caller.dispose(); };
  return { signal, assert, dispose, key: async requestSignal => {
    const operationSignal = requestSignal ? AbortSignal.any([signal, requestSignal]) : signal;
    const current = () => { assert(); if (operationSignal.aborted) throw new Error('Consulta de credencial cancelada.'); };
    current();
    let value: unknown = null;
    if (client && owner) {
      const user = await client.auth.getUser(); current();
      if (user.error || user.data.user?.id !== owner) { controller.abort(); throw new Error('La sesión nativa de credenciales fue rechazada.'); }
      const result = await client.rpc('get_api_key', { p_provider: provider }).abortSignal(operationSignal); current();
      if (result.error) throw new Error('No se pudo consultar la credencial nativa.');
      value = result.data;
      if (value !== null && typeof value !== 'string') throw new Error('Credencial nativa no válida.');
    }
    if (value === null || value === '') value = deps.environmentKey() ?? '';
    current();
    if (typeof value !== 'string' || !value.trim()) {
      if (provider === 'openai') throw new NativeOpenAIKeyMissingError();
      throw new Error('No hay una clave Gemini disponible.');
    }
    const key = value.trim();
    if (key.length < 20 || key.length > 512 || !/^[\x21-\x7e]+$/.test(key)) throw new Error('Credencial nativa no válida.');
    return key;
  } };
}

export function nativeOpenAIAuthority(caller: OpenAICaller, deps: CredentialDependencies = dependencies): OpenAIAuthority {
  return nativeProviderAuthority(caller, deps, 'openai');
}

/** Misma vinculación SOFIA/Lia y vigencia, con clave Google exclusivamente nativa. */
export function nativeGeminiAuthority(caller: OpenAICaller, deps: CredentialDependencies = geminiDependencies): OpenAIAuthority {
  return nativeProviderAuthority(caller, deps, 'google');
}
