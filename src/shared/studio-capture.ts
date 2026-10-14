import { z } from 'zod';
import type { DisplayMediaKind } from './display-media';

export interface StudioCaptureBinding {
  id: string;
  name: string;
  kind: DisplayMediaKind;
  thumbnail: string | null;
  withSystemAudio: boolean;
}
export type StudioCaptureResult = { success: true; binding: StudioCaptureBinding | null } | { success: false; error: string };
export const studioCaptureActivateSchema = z.object({ bindingId: z.string().uuid().nullable(), preview: z.boolean() }).strict();
export const studioCaptureReleaseSchema = z.object({ bindingId: z.string().uuid() }).strict();
export interface StudioCaptureApi {
  choose(): Promise<StudioCaptureResult>;
  activate(input: z.infer<typeof studioCaptureActivateSchema>): Promise<{ success: boolean; error?: string }>;
  release(input: z.infer<typeof studioCaptureReleaseSchema>): Promise<{ success: boolean; error?: string }>;
  clear(): Promise<{ success: boolean; error?: string }>;
}
declare global { interface Window { studioCapture?: StudioCaptureApi } }
