import { isSkillType, type Skill, type SkillInput } from './skills-types';
import type { MemoryServiceConstructor } from './service-types';

/**
 * Almacen de skills (conocimiento aprendido) sobre SQLite. Sigue el patron de
 * `service-facts`: upsert con dedup por (owner_key, skill_type, title) y refuerzo
 * de confianza/uso al reaparecer. Aislado estrictamente por `owner_key`.
 */

const DEFAULT_CONFIDENCE = 0.6;
const CONFIDENCE_REINFORCEMENT = 0.1;
const DEFAULT_RELEVANT_LIMIT = 8;

type SkillRow = {
  id: number;
  owner_key: string;
  skill_type: string;
  title: string;
  content: string;
  trigger_context: string | null;
  confidence: number;
  usage_count: number;
  last_used_at: string | null;
  source: string | null;
};

function toSkill(row: SkillRow): Skill {
  return {
    id: row.id,
    ownerKey: row.owner_key,
    type: isSkillType(row.skill_type) ? row.skill_type : 'contexto_trabajo',
    title: row.title,
    content: row.content,
    triggerContext: row.trigger_context,
    confidence: row.confidence,
    usageCount: row.usage_count,
    lastUsedAt: row.last_used_at,
    source: row.source,
  };
}

export function attachMemorySkills(Service: MemoryServiceConstructor): void {
  Object.assign(Service.prototype, {
    saveSkill(params: SkillInput): { success: boolean; message?: string } {
      if (!this.db) return { success: false, message: 'Database not initialized' };
      const ownerKey = String(params.ownerKey ?? '').trim();
      const title = String(params.title ?? '').trim();
      const content = String(params.content ?? '').trim();
      if (!ownerKey || !title || !content || !isSkillType(params.type)) {
        return { success: false, message: 'Skill invalida (owner/type/title/content requeridos).' };
      }
      const confidence = clampConfidence(params.confidence ?? DEFAULT_CONFIDENCE);
      try {
        // Al reaparecer: refuerza confianza (hasta 1.0), suma uso y actualiza el
        // contenido a la version mas reciente.
        this.db.prepare(`
          INSERT INTO skills (owner_key, skill_type, title, content, trigger_context, confidence, usage_count, source, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, 0, ?, datetime('now'))
          ON CONFLICT(owner_key, skill_type, title) DO UPDATE SET
            content = excluded.content,
            trigger_context = COALESCE(excluded.trigger_context, skills.trigger_context),
            confidence = MIN(1.0, skills.confidence + ${CONFIDENCE_REINFORCEMENT}),
            usage_count = skills.usage_count + 1,
            source = COALESCE(excluded.source, skills.source),
            updated_at = datetime('now')
        `).run(ownerKey, params.type, title, content, params.triggerContext ?? null, confidence, params.source ?? null);
        return { success: true, message: 'Skill guardada.' };
      } catch (err: any) {
        console.error('[MemoryService] saveSkill error:', err.message);
        return { success: false, message: err.message };
      }
    },

    getRelevantSkills(ownerKey: string, limit = DEFAULT_RELEVANT_LIMIT): Skill[] {
      if (!this.db || !ownerKey) return [];
      try {
        // Solo conocimiento que personaliza; los procedimientos_ejecutables tienen
        // su propia sección (su content es una receta serializada, no texto).
        const rows = this.db.prepare(`
          SELECT * FROM skills
          WHERE owner_key = ? AND skill_type <> 'procedimiento_ejecutable'
          ORDER BY confidence DESC, usage_count DESC, updated_at DESC
          LIMIT ?
        `).all(ownerKey, Math.max(1, limit)) as SkillRow[];
        return rows.map(toSkill);
      } catch (err: any) {
        console.error('[MemoryService] getRelevantSkills error:', err.message);
        return [];
      }
    },

    getExecutableSkills(ownerKey: string): Skill[] {
      if (!this.db || !ownerKey) return [];
      try {
        const rows = this.db.prepare(`
          SELECT * FROM skills
          WHERE owner_key = ? AND skill_type = 'procedimiento_ejecutable'
          ORDER BY usage_count DESC, updated_at DESC
        `).all(ownerKey) as SkillRow[];
        return rows.map(toSkill);
      } catch (err: any) {
        console.error('[MemoryService] getExecutableSkills error:', err.message);
        return [];
      }
    },

    listSkills(ownerKey: string): Skill[] {
      if (!this.db || !ownerKey) return [];
      try {
        const rows = this.db.prepare(`
          SELECT * FROM skills WHERE owner_key = ? ORDER BY updated_at DESC
        `).all(ownerKey) as SkillRow[];
        return rows.map(toSkill);
      } catch (err: any) {
        console.error('[MemoryService] listSkills error:', err.message);
        return [];
      }
    },

    deleteSkill(skillId: number): boolean {
      if (!this.db) return false;
      try {
        this.db.prepare('DELETE FROM skills WHERE id = ?').run(skillId);
        return true;
      } catch {
        return false;
      }
    },

    markSkillUsed(skillId: number): void {
      if (!this.db) return;
      try {
        this.db.prepare(`
          UPDATE skills SET usage_count = usage_count + 1, last_used_at = datetime('now') WHERE id = ?
        `).run(skillId);
      } catch {
        // no bloqueante
      }
    },
  } satisfies MemorySkillsApi & ThisType<any>);
}

export interface MemorySkillsApi {
  saveSkill(params: SkillInput): { success: boolean; message?: string };
  getRelevantSkills(ownerKey: string, limit?: number): Skill[];
  getExecutableSkills(ownerKey: string): Skill[];
  listSkills(ownerKey: string): Skill[];
  deleteSkill(skillId: number): boolean;
  markSkillUsed(skillId: number): void;
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_CONFIDENCE;
  return Math.max(0, Math.min(1, value));
}
