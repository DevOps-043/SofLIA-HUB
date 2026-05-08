import { createRequire } from 'node:module';

const _require = createRequire(import.meta.url);

export function loadOptionalSharp(): any {
  try {
    return _require('sharp');
  } catch (err: any) {
    console.warn('[MonitoringService] sharp module not available - screenshot compositing disabled:', err.message);
    return null;
  }
}
