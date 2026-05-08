import { createRequire } from 'node:module';
import type { SharpFactory } from './sharp-types';

export type { SharpFactory } from './sharp-types';

export function loadSharp(): SharpFactory | null {
  try {
    const requireFromModule = createRequire(import.meta.url);
    return requireFromModule('sharp') as SharpFactory;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[DesktopAgent] sharp not available - overlays disabled:', message);
    return null;
  }
}
