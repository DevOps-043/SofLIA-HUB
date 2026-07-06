import { createRequire } from 'node:module';
import type { CuEnvironment, CuFunctionCall } from './types';

/**
 * Cliente de la Computer Use API (@google/genai). Mantiene la conversacion con
 * la herramienta `computer_use`: cada vuelta recibe una captura y devuelve la
 * siguiente `function_call` (accion + coords 0-999 + intent + safety_decision).
 *
 * El SDK se carga perezosamente (createRequire) para degradar con elegancia si
 * no estuviera disponible; en ese caso `disponible()` = false y el backend CU no
 * se activa (el loop de vision legacy sigue).
 */

// Superficie minima del SDK que usamos (sin acoplarnos a sus tipos completos).
type GenAiPart = Record<string, unknown>;
type GenAiContent = { role?: string; parts?: GenAiPart[] };
type GenAiResponse = {
  functionCalls?: CuFunctionCall[];
  text?: string;
  candidates?: Array<{ content?: GenAiContent }>;
};
type GenAiModels = {
  generateContent: (params: {
    model: string;
    contents: GenAiContent[];
    config?: Record<string, unknown>;
  }) => Promise<GenAiResponse>;
};
type GenAiClient = { models: GenAiModels };
type GenAiModule = {
  GoogleGenAI: new (opts: { apiKey: string }) => GenAiClient;
  createPartFromFunctionResponse: (id: string, name: string, response: Record<string, unknown>, parts?: Array<{ inlineData: { mimeType: string; data: string } }>) => GenAiPart;
};

export type CuClientOptions = {
  apiKey: string;
  model: string;
  environment: CuEnvironment;
  excludedFunctions?: string[];
  enablePromptInjectionDetection?: boolean;
  /** Inyectable para tests; por defecto se carga @google/genai. */
  loadSdk?: () => GenAiModule | null;
};

export type CuTurn = {
  /** Primera function_call de la respuesta, o null si el modelo termino con texto. */
  functionCall: CuFunctionCall | null;
  /** Texto libre del modelo (cuando no hay accion: respuesta/fin). */
  text: string;
};

export interface CuClient {
  disponible(): boolean;
  iniciar(task: string, screenshotBase64: string): Promise<CuTurn>;
  continuar(
    callId: string | null,
    name: string,
    screenshotBase64: string,
    extraResponse?: Record<string, unknown>,
  ): Promise<CuTurn>;
}

export function loadGenAiSdk(): GenAiModule | null {
  try {
    const requireFromModule = createRequire(import.meta.url);
    return requireFromModule('@google/genai') as GenAiModule;
  } catch {
    return null;
  }
}

export function createComputerUseClient(options: CuClientOptions): CuClient {
  const loadSdk = options.loadSdk ?? loadGenAiSdk;
  let sdk: GenAiModule | null | undefined;
  let client: GenAiClient | null = null;
  const contents: GenAiContent[] = [];

  function getSdk(): GenAiModule | null {
    if (sdk === undefined) sdk = loadSdk();
    return sdk;
  }

  function toolConfig(): Record<string, unknown> {
    const computerUse: Record<string, unknown> = { environment: options.environment };
    if (options.excludedFunctions?.length) computerUse.excludedPredefinedFunctions = options.excludedFunctions;
    if (options.enablePromptInjectionDetection) computerUse.enablePromptInjectionDetection = true;
    return { tools: [{ computerUse }] };
  }

  function ensureClient(): GenAiClient | null {
    if (client) return client;
    const mod = getSdk();
    if (!mod || !options.apiKey) return null;
    client = new mod.GoogleGenAI({ apiKey: options.apiKey });
    return client;
  }

  async function generar(): Promise<CuTurn> {
    const active = ensureClient();
    if (!active) throw new Error('Computer Use no disponible (SDK/API key).');
    const resp = await active.models.generateContent({ model: options.model, contents, config: toolConfig() });
    const modelContent = resp.candidates?.[0]?.content;
    if (modelContent) contents.push(modelContent);
    const functionCall = resp.functionCalls?.[0] ?? null;
    return { functionCall, text: resp.text ?? '' };
  }

  return {
    disponible: () => Boolean(getSdk() && options.apiKey),
    async iniciar(task: string, screenshotBase64: string): Promise<CuTurn> {
      contents.length = 0;
      contents.push({
        role: 'user',
        parts: [
          { text: task },
          { inlineData: { mimeType: 'image/png', data: screenshotBase64 } },
        ],
      });
      return generar();
    },
    async continuar(callId, name, screenshotBase64, extraResponse): Promise<CuTurn> {
      const mod = getSdk();
      if (!mod) throw new Error('Computer Use SDK no disponible.');
      const part = mod.createPartFromFunctionResponse(
        callId ?? '',
        name || 'action',
        extraResponse ?? {},
        [{ inlineData: { mimeType: 'image/png', data: screenshotBase64 } }],
      );
      contents.push({ role: 'user', parts: [part] });
      return generar();
    },
  };
}
