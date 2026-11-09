import type { SessionTextOptions } from '../ai-provider/text';

export type DesktopInference = (prompt: string, options?: SessionTextOptions) => Promise<string>;
export { generateSessionText as inferDesktop } from '../ai-provider/text';
