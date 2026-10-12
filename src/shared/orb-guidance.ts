import { z } from 'zod';

export type GuidancePoint = { x: number; y: number };
export type GuidanceRect = GuidancePoint & { width: number; height: number };
export type GuidanceTarget = { point: GuidancePoint; rect?: GuidanceRect };
export type GuidanceStyle = 'frame' | 'halo' | 'arrow' | 'focus';
export type GuidanceState = {
  revision: number;
  phase: 'idle' | 'presenting' | 'paused' | 'practice' | 'verifying' | 'complete';
  enabled: boolean;
  reducedMotion: boolean;
  style: GuidanceStyle;
  instruction: string;
  target: GuidanceTarget | null;
  practice: { title: string; step: number; total: number } | null;
  message: string | null;
};

const shortText = z.string().trim().min(1).max(300);
export const guidanceRequestSchema = z.object({
  targetText: shortText,
  instruction: shortText,
  style: z.enum(['frame', 'halo', 'arrow', 'focus']).optional(),
}).strict();
export type GuidanceRequest = z.infer<typeof guidanceRequestSchema>;
export const practiceDefinitionSchema = z.object({
  title: shortText,
  steps: z.array(z.object({
    instruction: shortText,
    targetText: shortText,
    expectedText: shortText,
  }).strict()).min(1).max(20),
}).strict();
export type PracticeDefinition = z.infer<typeof practiceDefinitionSchema>;

export const guidanceControlSchema = z.discriminatedUnion('action', [
  z.object({ action: z.enum(['pause', 'resume', 'stop']) }).strict(),
  z.object({ action: z.literal('style'), style: z.enum(['frame', 'halo', 'arrow', 'focus']) }).strict(),
  z.object({ action: z.literal('motion'), reduced: z.boolean() }).strict(),
]);
export type GuidanceControl = z.infer<typeof guidanceControlSchema>;
export type GuidanceResult = { success: boolean; state?: GuidanceState; error?: string };

export function initialGuidanceState(): GuidanceState {
  return { revision: 0, phase: 'idle', enabled: true, reducedMotion: false, style: 'frame', instruction: '', target: null, practice: null, message: null };
}

/** La geometría de la guía siempre está en DIP de escritorio, nunca en píxeles de captura. */
export function validGuidanceTarget(target: GuidanceTarget): boolean {
  const finite = (value: number) => Number.isFinite(value) && Math.abs(value) <= 200_000;
  return finite(target.point.x) && finite(target.point.y) && (!target.rect || (
    finite(target.rect.x) && finite(target.rect.y)
    && Number.isFinite(target.rect.width) && target.rect.width > 0 && target.rect.width <= 32_768
    && Number.isFinite(target.rect.height) && target.rect.height > 0 && target.rect.height <= 32_768
  ));
}
