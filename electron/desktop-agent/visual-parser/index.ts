import fs from 'node:fs';
import path from 'node:path';
import { createOnnxVisualParser, type OnnxParserOptions } from './onnx-parser';
import type { VisualParser } from './types';

export { createOnnxVisualParser, loadOnnxRuntime } from './onnx-parser';
export { decodeYoloV8Output, nonMaxSuppression, iouBox, resolveYoloLayout } from './yolo-postprocess';
export { computeLetterbox, mapBoxToOriginal, clampBox } from './letterbox';
export type { VisualBox, VisualParser } from './types';
export type { Letterbox } from './letterbox';

/** Nombre del asset del detector de iconos de OmniParser exportado a ONNX. */
export const OMNIPARSER_MODEL_FILENAME = 'omniparser-icon-detect.onnx';

/**
 * Resuelve la ruta del modelo ONNX probando, en orden: variable de entorno,
 * un directorio `models/` junto al userData del app, y `models/` del cwd (dev).
 * Devuelve la primera que exista, o null (parser reportara no-disponible).
 */
export function resolveOmniParserModelPath(userDataDir?: string): string | null {
  const candidatos = [
    process.env.OMNIPARSER_MODEL_PATH,
    userDataDir ? path.join(userDataDir, 'models', OMNIPARSER_MODEL_FILENAME) : null,
    path.join(process.cwd(), 'models', OMNIPARSER_MODEL_FILENAME),
  ].filter((candidato): candidato is string => Boolean(candidato));

  for (const candidato of candidatos) {
    try {
      if (fs.existsSync(candidato)) return candidato;
    } catch {
      // Ignorar rutas inaccesibles.
    }
  }
  return null;
}

export function createOmniParser(options: Omit<OnnxParserOptions, 'resolveModelPath'> & {
  userDataDir?: string;
  resolveModelPath?: () => string | null;
}): VisualParser {
  return createOnnxVisualParser({
    ...options,
    resolveModelPath: options.resolveModelPath ?? (() => resolveOmniParserModelPath(options.userDataDir)),
  });
}
