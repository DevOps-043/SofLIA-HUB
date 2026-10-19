import { z } from 'zod';

export const PROGRAM_WIDTH = 1280;
export const PROGRAM_HEIGHT = 720;
export const PROGRAM_FPS = 30;
export const transitionSchema = z.object({
  effect: z.enum(['cut', 'fade', 'wipe', 'visual']),
  durationMs: z.number().int().min(100).max(10000),
  sceneId: z.string().min(1).max(200).optional(),
}).strict().superRefine((value, context) => {
  if (value.effect === 'visual') {
    if (!value.sceneId) context.addIssue({ code: 'custom', message: 'Elige una imagen o pantalla intermedia.' });
    if (value.durationMs < 500) context.addIssue({ code: 'custom', message: 'El intervalo mínimo es 500 ms.' });
  } else if (value.durationMs > 2000) context.addIssue({ code: 'custom', message: 'La duración máxima es 2000 ms.' });
});
export type StudioTransition = z.infer<typeof transitionSchema>;
export const holdingSchema = z.object({ phase: z.enum(['waiting', 'starting', 'break', 'ending']), seconds: z.number().int().min(0).max(7200) }).strict();
export type StudioHolding = z.infer<typeof holdingSchema>;
export const HOLDING_PRESETS: Record<StudioHolding['phase'], { name: string; title: string; description: string; seconds: number }> = {
  waiting: { name: 'Espera', title: 'En breve comenzamos', description: 'Te damos la bienvenida. Prepara tu espacio para aprender.', seconds: 0 },
  starting: { name: 'Inicio del curso', title: 'Estamos por comenzar', description: 'En unos momentos iniciamos la sesión.', seconds: 300 },
  break: { name: 'Receso', title: 'Tomamos un breve receso', description: 'Regresamos en unos minutos. Mantén abierta tu sesión.', seconds: 300 },
  ending: { name: 'Cierre del curso', title: 'Gracias por aprender con nosotros', description: 'La sesión ha terminado. Nos vemos en Learning.', seconds: 0 },
};
export function countdownText(deadline: number | null, now: number): string | null {
  if (deadline === null) return null;
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}
// Solo señalización local; nunca se aceptan rutas, URLs, archivos ni credenciales.
export const outputOfferSchema = z.object({ type: z.literal('offer'), sdp: z.string().min(1).max(65536) }).strict();
export const outputAnswerSchema = z.object({ type: z.literal('answer'), sdp: z.string().min(1).max(65536) }).strict();
export type OutputOffer = z.infer<typeof outputOfferSchema>;
export type OutputAnswer = z.infer<typeof outputAnswerSchema>;
export type StudioOutputEvent = { state: 'ready' | 'closed' | 'error' };
export interface StudioOutputApi {
  open(offer: OutputOffer): Promise<{ success: true; answer: OutputAnswer } | { success: false; error: string }>;
  close(): Promise<{ success: boolean }>;
  onState(callback: (event: StudioOutputEvent) => void): () => void;
}
export interface StudioOutputReceiverApi {
  offer(): Promise<{ id: string; offer: OutputOffer } | null>;
  answer(payload: { id: string; answer: OutputAnswer }): Promise<{ success: boolean }>;
  state(payload: { id: string; state: 'ready' | 'error' }): Promise<{ success: boolean }>;
}
declare global { interface Window { studioOutput?: StudioOutputApi; studioOutputReceiver?: StudioOutputReceiverApi } }
