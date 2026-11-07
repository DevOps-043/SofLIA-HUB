import type { CuFunctionCall } from './types';
export type CuTurn = {
  /** Primera function_call de la respuesta, o null si el modelo termino con texto. */
  functionCall: CuFunctionCall | null;
  /** Texto libre del modelo (cuando no hay accion: respuesta/fin). */
  text: string;
};

export type CuCompletionVerification = { confirmed: boolean; reason: string; canContinue?: boolean };

export interface CuClient {
  disponible(): boolean;
  iniciar(task: string, screenshotBase64: string, context?: Record<string, unknown>, signal?: AbortSignal): Promise<CuTurn>;
  continuar(
    callId: string | null,
    name: string,
    screenshotBase64: string,
    extraResponse?: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<CuTurn>;
  verificar?(task: string, screenshotBase64: string, claimedResult: string, signal?: AbortSignal): Promise<CuCompletionVerification>;
  reanudar?(screenshotBase64: string, reason: string, signal?: AbortSignal): Promise<CuTurn>;
}

