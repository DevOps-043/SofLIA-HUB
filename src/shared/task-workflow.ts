import { z } from 'zod';

export const taskStage = z.enum(['backlog', 'pending', 'todo', 'in_progress', 'in_review', 'done', 'cancelled']);
export const taskStages = [
  { type: 'backlog', name: 'Backlog' },
  { type: 'pending', name: 'Pendientes' },
  { type: 'todo', name: 'Por hacer' },
  { type: 'in_progress', name: 'En curso' },
  { type: 'in_review', name: 'En revisión' },
  { type: 'done', name: 'Completadas' },
  { type: 'cancelled', name: 'Canceladas' },
] as const;

export function taskStageFor(name: string, type: string): string {
  const normalized = name.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return ['pendiente', 'pendientes', 'pending'].includes(normalized) && ['todo', 'unknown'].includes(type) ? 'pending' : type;
}

export const taskResourceTypes = [
  { value: 'photo', label: 'Foto' },
  { value: 'document', label: 'Documento' },
  { value: 'web', label: 'Página web' },
  { value: 'team_chat', label: 'Chat del equipo' },
] as const;
export const taskResource = z.object({
  type: z.enum(['photo', 'document', 'web', 'team_chat']),
  name: z.string().trim().min(1).max(255),
  url: z.string().url().max(4000).refine(value => {
    try {
      const url = new URL(value);
      return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
    } catch { return false; }
  }),
}).strict();
export type TaskResource = z.infer<typeof taskResource>;
