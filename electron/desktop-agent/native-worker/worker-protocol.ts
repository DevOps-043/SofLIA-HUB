/**
 * Protocolo del worker de PowerShell persistente.
 *
 * Motivación: pasar scripts UIA por `powershell -EncodedCommand <base64>`
 * choca con el límite de 8191 caracteres de la línea de comandos de Windows
 * ("La línea de comandos es demasiado larga"). Un worker de larga vida recibe
 * el script de arranque por STDIN (sin límite) UNA vez, compila los ensamblados
 * UIA/P-Invoke una sola vez, y luego atiende peticiones JSON línea a línea.
 *
 * Contrato de framing: cada respuesta del worker viaja como una línea con el
 * prefijo centinela `##SOFLIA##` seguido del JSON, para poder filtrar el ruido
 * que PowerShell escribe en stdout.
 */

export const WORKER_RESPONSE_SENTINEL = '##SOFLIA##';

/** Rectángulo en píxeles FÍSICOS de pantalla (como los reporta UIA). */
export type PhysicalRect = { x: number; y: number; width: number; height: number };

export type WorkerElement = {
  name: string;
  controlType: string;
  rect: PhysicalRect;
  /** Punto clickeable físico si UIA lo expone (GetClickablePoint); si no, centro del rect. */
  clickX: number;
  clickY: number;
};

export type WorkerRequest =
  | { id: number; cmd: 'ping' }
  | {
      id: number;
      cmd: 'locateByText';
      /** Umbral de elementos por debajo del cual se considera árbol sin construir. */
      sparseThreshold: number;
      /** Espera (ms) antes de reconsultar para "despertar" accesibilidad Chromium/Java. */
      wakeDelayMs: number;
      /** Máximo de candidatos a devolver (con nombre no vacío). */
      maxElements: number;
    }
  | {
      id: number;
      cmd: 'listElements';
      /** Umbral de elementos por debajo del cual se considera árbol sin construir. */
      sparseThreshold: number;
      /** Espera (ms) antes de reconsultar para "despertar" accesibilidad Chromium/Java. */
      wakeDelayMs: number;
      maxElements: number;
    };

export type WorkerResponse =
  | { id: number; ok: true; cmd: 'ping'; pong: true }
  | { id: number; ok: true; cmd: 'locateByText'; elements: WorkerElement[]; scanned: number }
  | { id: number; ok: true; cmd: 'listElements'; elements: WorkerElement[]; scanned: number }
  | { id: number; ok: false; error: string };

export function encodeRequest(request: WorkerRequest): string {
  return JSON.stringify(request);
}

/** Extrae la respuesta JSON de una línea de stdout, o null si no lleva el centinela. */
export function decodeResponseLine(line: string): WorkerResponse | null {
  const index = line.indexOf(WORKER_RESPONSE_SENTINEL);
  if (index === -1) return null;
  const jsonPart = line.slice(index + WORKER_RESPONSE_SENTINEL.length).trim();
  if (!jsonPart) return null;
  try {
    return JSON.parse(jsonPart) as WorkerResponse;
  } catch {
    return null;
  }
}
