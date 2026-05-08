export type SharpMetadata = { width?: number; height?: number };

export type SharpCompositeInput = { input: Buffer; top: number; left: number };

export type SharpCreateInput = {
  create: {
    width: number;
    height: number;
    channels: 4;
    background: { r: number; g: number; b: number; alpha: number };
  };
};

export type SharpPipeline = {
  metadata(): Promise<SharpMetadata>;
  composite(inputs: SharpCompositeInput[]): SharpPipeline;
  extract(region: { left: number; top: number; width: number; height: number }): SharpPipeline;
  resize(width: number, height: number, options?: { fit: 'fill' }): SharpPipeline;
  png(): SharpPipeline;
  toBuffer(): Promise<Buffer>;
};

export type SharpFactory = (input: Buffer | SharpCreateInput) => SharpPipeline;
export type SharpModule = SharpFactory;
export type ImageComposite = SharpCompositeInput;
