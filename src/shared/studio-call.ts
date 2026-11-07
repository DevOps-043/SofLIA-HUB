import { z } from 'zod';

/** Capacidades confirmadas por el runtime, nunca permisos elegidos por la UI. */
export const studioCallControlsSchema = z.object({
  camera: z.boolean(), captions: z.boolean(), captionsEnabled: z.boolean(),
}).strict();
export type StudioCallControls = z.infer<typeof studioCallControlsSchema>;
export type StudioCallCommand = 'mute' | 'toggle-mic' | 'toggle-camera' | 'captions' | 'visit-room' | 'sync-rooms' | 'leave' | 'stop-share' | 'get-devices' | 'select-device';
export const studioRoomPlanSchema=z.array(z.object({id:z.string().uuid(),user_ids:z.array(z.string().uuid()).max(500)}).strict()).max(50).refine(rooms=>{
  const people=rooms.flatMap(room=>room.user_ids);
  return new Set(rooms.map(room=>room.id)).size===rooms.length&&people.length<=500&&new Set(people).size===people.length;
});
export type StudioRoomPlan=z.infer<typeof studioRoomPlanSchema>;
export const studioRoomsStatusSchema=z.object({status:z.enum(['ready','waiting','unavailable']),missing:z.number().int().min(0).max(500)}).strict();
export type StudioRoomsStatus=z.infer<typeof studioRoomsStatusSchema>;
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
