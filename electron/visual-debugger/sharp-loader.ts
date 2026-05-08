import { createRequire } from 'node:module';

let sharpInstance: any = null;

try {
  const _require = createRequire(import.meta.url);
  sharpInstance = _require('sharp');
} catch (err: any) {
  console.warn('[VisualDebugger] sharp not available:', err.message);
}

export function getSharp(): any {
  if (!sharpInstance) throw new Error('Sharp no esta disponible para componer la captura.');
  return sharpInstance;
}
