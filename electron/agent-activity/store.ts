import { z } from 'zod';
import type { AgentActivity } from '../../src/shared/agent-activity';
export const activitySchema = z.object({
  id: z.string().uuid(), sequence: z.number().int().min(1).max(1_000_000),
  surface: z.enum(['chat', 'whatsapp', 'browser', 'computer', 'meetings']),
  kind: z.enum(['analysis', 'document', 'presentation', 'browser', 'computer', 'meeting']),
  status: z.enum(['running', 'completed', 'partial', 'unavailable', 'cancelled']),
  durationMs: z.number().int().min(0).max(86_400_000),
  agents: z.array(z.object({
    role: z.enum(['analisis', 'evidencia', 'analisis-pagina', 'contenido', 'estructura', 'diseno', 'plan', 'verificacion', 'acuerdos', 'coordinador']),
    status: z.enum(['pending', 'running', 'completed', 'failed', 'timed_out', 'cancelled', 'skipped']),
  }).strict()).min(1).max(3),
}).strict();

export class ActivityStore {
  private items = new Map<string, AgentActivity>();
  clear(): void { this.items.clear(); }
  snapshot(): AgentActivity[] { return structuredClone([...this.items.values()].reverse()); }
  accept(origin: 'main' | 'renderer' | 'meeting', value: AgentActivity): boolean {
    const parsed = activitySchema.safeParse(value);
    if (!parsed.success) return false;
    const item = parsed.data; const key = `${origin}:${item.id}`; const previous = this.items.get(key);
    if (previous && (previous.sequence >= item.sequence || previous.status !== 'running')) return false;
    if (!previous) {
      // Tras limpiar sesión no se resucitan equipos con eventos intermedios.
      if (item.sequence !== 1 || item.status !== 'running') return false;
      if (this.items.size >= 12) {
        const victim = [...this.items].find(([, run]) => run.status !== 'running');
        if (!victim) return false;
        this.items.delete(victim[0]);
      }
    }
    this.items.set(key, { ...item, id: key });
    return true;
  }
}
