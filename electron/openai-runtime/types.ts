import type { NativeOpenAIRequest } from '../../src/shared/openai-runtime';
import type { Response, ResponseStreamEvent } from 'openai/resources/responses/responses';

export interface OpenAICaller { userId: string | null; signal: AbortSignal; assert(): void; dispose(): void }
export interface OpenAIAuthority { signal: AbortSignal; assert(): void; key(signal?: AbortSignal): Promise<string>; dispose(): void }
export interface OpenAIScope { id: string; sender: object; frame: unknown; userId: string; authority: OpenAIAuthority }
export type OpenAIProvider = (scope: OpenAIScope, body: NativeOpenAIRequest, signal: AbortSignal, maxRetries: number) => Promise<Response | AsyncIterable<ResponseStreamEvent>>;
