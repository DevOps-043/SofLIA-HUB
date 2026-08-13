import { shell } from 'electron';

/**
 * Apertura del inicio de sesion federado con SofLIA Learning.
 *
 * El renderer NO envia una URL: solo su `state` y su desafio. La direccion la
 * construye este modulo a partir de la configuracion, de modo que un renderer
 * comprometido no pueda usar el canal para abrir una direccion arbitraria en el
 * navegador del usuario.
 */

const START_PATH = '/api/auth/desktop/start';

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

export interface OpenLearningSsoInput {
  state: string;
  codeChallenge: string;
}

export type OpenLearningSsoResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Instantanea tomada al compilar, no al ejecutar.
 *
 * `config/vite/env-defines.mts` sustituye la expresion literal
 * `process.env.VITE_LEARNING_BASE_URL` por su valor dentro del bundle main. La
 * sustitucion es textual: leer la variable a traves de un objeto
 * (`env.VITE_LEARNING_BASE_URL`) la esquiva, y en la aplicacion empaquetada eso
 * devuelve vacio porque ahi `process.env` solo trae el entorno del sistema
 * operativo: el `.env` del runner no viaja al equipo del usuario.
 */
const BUILD_TIME_BASE_URL = process.env.VITE_LEARNING_BASE_URL || '';

export function readLearningBaseUrl(env?: NodeJS.ProcessEnv): string {
  // Un `env` explicito manda tal cual: es como las pruebas describen un entorno
  // sin configurar sin depender de con que se compilo.
  const configured = env ? env.VITE_LEARNING_BASE_URL : BUILD_TIME_BASE_URL;
  return (configured || '').trim().replace(/\/+$/, '');
}

function isValidChallenge(value: unknown): value is string {
  return typeof value === 'string' && value.length === 43 && BASE64URL_PATTERN.test(value);
}

function isValidState(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 16 &&
    value.length <= 128 &&
    BASE64URL_PATTERN.test(value)
  );
}

/**
 * Solo https, y solo el origen configurado. Un `http:` en produccion expondria
 * el ticket en la vuelta; cualquier otro esquema no tendria sentido aqui.
 */
export function buildLearningSsoUrl(
  input: OpenLearningSsoInput,
  env?: NodeJS.ProcessEnv,
): string | null {
  if (!isValidState(input?.state) || !isValidChallenge(input?.codeChallenge)) {
    return null;
  }

  const baseUrl = readLearningBaseUrl(env);
  if (!baseUrl) return null;

  let target: URL;
  try {
    target = new URL(`${baseUrl}${START_PATH}`);
  } catch {
    return null;
  }

  const allowLocalHttp =
    target.protocol === 'http:' &&
    (target.hostname === 'localhost' || target.hostname === '127.0.0.1');
  if (target.protocol !== 'https:' && !allowLocalHttp) {
    return null;
  }

  target.searchParams.set('state', input.state);
  target.searchParams.set('code_challenge', input.codeChallenge);
  return target.toString();
}

export async function openLearningSso(
  input: OpenLearningSsoInput,
  env?: NodeJS.ProcessEnv,
): Promise<OpenLearningSsoResult> {
  const url = buildLearningSsoUrl(input, env);
  if (!url) {
    return { success: false, error: 'El inicio de sesion federado no esta configurado.' };
  }

  try {
    // Navegador del sistema, nunca el integrado: los proveedores de identidad
    // rechazan agentes embebidos y ademas el escritorio no debe ver el
    // formulario de credenciales.
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('[sso-learning] no se pudo abrir el navegador del sistema');
    void error;
    return { success: false, error: 'No pudimos abrir tu navegador. Intenta nuevamente.' };
  }
}
