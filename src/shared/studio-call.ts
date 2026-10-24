import { z } from 'zod';

/** Capacidades confirmadas por el runtime, nunca permisos elegidos por la UI. */
export const studioCallControlsSchema = z.object({
  camera: z.boolean(), captions: z.boolean(), captionsEnabled: z.boolean(),
}).strict();
export type StudioCallControls = z.infer<typeof studioCallControlsSchema>;
export type StudioCallCommand = 'mute' | 'toggle-mic' | 'toggle-camera' | 'captions' | 'visit-room' | 'leave' | 'stop-share';
export const studioCaptionSchema = z.object({ text: z.string().max(2000), speaker: z.string().max(160) }).strict();
export type StudioCaption = z.infer<typeof studioCaptionSchema>;
