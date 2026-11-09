import { z } from 'zod';

export const taskDifficulty = z.enum(['unestimated', 'low', 'medium', 'high']);
export type TaskDifficulty = z.infer<typeof taskDifficulty>;
export const taskDifficultyOptions = [
  { value: 'unestimated', label: 'Sin estimar', points: null },
  { value: 'low', label: 'Baja', points: 2 },
  { value: 'medium', label: 'Media', points: 5 },
  { value: 'high', label: 'Alta', points: 8 },
] as const;
export function taskDifficultyFor(points: unknown): TaskDifficulty {
  if (typeof points !== 'number' || !Number.isFinite(points) || points < 0) return 'unestimated';
  return points <= 2 ? 'low' : points <= 5 ? 'medium' : 'high';
}
