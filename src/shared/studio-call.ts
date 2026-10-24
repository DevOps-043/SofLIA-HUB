import { z } from 'zod';

/** Capacidades confirmadas por el runtime, nunca permisos elegidos por la UI. */
export const studioCallControlsSchema = z.object({
  camera: z.boolean(), captions: z.boolean(), captionsEnabled: z.boolean(),
}).strict();
export type StudioCallControls = z.infer<typeof studioCallControlsSchema>;
export type StudioCallCommand = 'mute' | 'toggle-mic' | 'toggle-camera' | 'captions' | 'visit-room' | 'leave' | 'stop-share' | 'get-devices' | 'select-device';
export const studioCaptionSchema = z.object({ text: z.string().max(2000), speaker: z.string().max(160) }).strict();
export type StudioCaption = z.infer<typeof studioCaptionSchema>;
const device=z.object({id:z.string().min(1).max(512),label:z.string().max(160)}).strict();
export const studioCallDevicesSchema=z.object({
  microphones:z.array(device).max(50),speakers:z.array(device).max(50),cameras:z.array(device).max(50),
  input:z.string().max(512),output:z.string().max(512),camera:z.string().max(512),
}).strict();
export const studioDeviceSelectionSchema=z.object({kind:z.enum(['microphone','speaker','camera']),id:z.string().min(1).max(512)}).strict();
export type StudioCallDevices=z.infer<typeof studioCallDevicesSchema>;
export type StudioDeviceSelection=z.infer<typeof studioDeviceSelectionSchema>;
