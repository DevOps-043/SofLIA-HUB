import { createProviderClient } from '../ai-provider/client';
import { OPENAI_IMAGE_MODEL } from '../../src/shared/image-generation';

export async function generateProviderImage(key: string, prompt: string, signal: AbortSignal): Promise<unknown> {
  signal.throwIfAborted();
  return createProviderClient(key).images.generate({ model: OPENAI_IMAGE_MODEL, prompt, n: 1, output_format: 'png' }, { signal });
}
