import { createRequire } from 'node:module';

export interface ImageMetadata {
  width?: number;
  height?: number;
}

export interface SharpCompositeInput {
  input: Buffer;
  top: number;
  left: number;
}

export interface SharpCreateInput {
  create: {
    width: number;
    height: number;
    channels: 4;
    background: { r: number; g: number; b: number; alpha: number };
  };
}

export type SharpInput = Buffer | SharpCreateInput;

export interface SharpPipeline {
  metadata(): Promise<ImageMetadata>;
  composite(inputs: SharpCompositeInput[]): SharpPipeline;
  extract(region: { left: number; top: number; width: number; height: number }): SharpPipeline;
  resize(width: number, height: number, options?: { fit: string }): SharpPipeline;
  png(): SharpPipeline;
  toBuffer(): Promise<Buffer>;
}

export type SharpRenderer = (input: SharpInput) => SharpPipeline;

export function loadSharpRenderer(moduleUrl: string): SharpRenderer | null {
  try {
    const requireFromModule = createRequire(moduleUrl);
    return requireFromModule('sharp') as SharpRenderer | null;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[DesktopAgent] sharp not available - overlays disabled:', message);
    return null;
  }
}
