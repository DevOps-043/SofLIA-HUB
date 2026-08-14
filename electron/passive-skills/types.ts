import type { SkillChannel } from '../../src/shared/skills/types';

/**
 * Skill pasiva: una programacion que ejecuta una Skill del catalogo —o un
 * prompt libre recordado— sin que el usuario la pida en ese momento, y entrega
 * el resultado por los canales que eligio.
 *
 * Sustituye a `PassiveWorkflowRule`. Sigue siendo una PROYECCION del registro
 * del `TaskScheduler`, no un almacen propio: el estado real vive en
 * `userData/scheduler-state.json` y ahi se persiste el cron.
 */

/**
 * `system` identifica una deteccion automatica del producto, que corre sola y
 * no se programa. Se lista para que el usuario sepa que existe, pero no ofrece
 * controles de programacion.
 */
export type PassiveSkillSource = 'legacy' | 'chat' | 'app' | 'system';

export type PassiveSkillStatus = 'active' | 'blocked' | 'system';

export interface PassiveSkillRule {
  id: string;
  /** Skill del catalogo que ejecuta. Nulo = rutina libre. */
  skillId: string | null;
  /** Nombre resuelto de la Skill, o el de la rutina libre. */
  skillName: string;
  name: string;
  description: string;
  prompt: string;
  scheduleLabel: string;
  cronExpression: string | null;
  runOnce: boolean;
  scheduledFor: string | null;
  channels: SkillChannel[];
  source: PassiveSkillSource;
  status: PassiveSkillStatus;
  createdAt: string;
  updatedAt: string;
  lastRunAt: string | null;
  requestedBy: string | null;
  phoneNumber: string | null;
  /** Por que esta bloqueada, o que hace si es del sistema. */
  reason: string | null;
}

export interface SavePassiveSkillInput {
  ruleId?: string | null;
  skillId?: string | null;
  name: string;
  description?: string;
  prompt?: string;
  cronExpression: string;
  scheduleLabel?: string;
  channels?: SkillChannel[];
  runOnce?: boolean;
  scheduledFor?: string | null;
  source?: 'chat' | 'app';
  requestedBy?: string | null;
  phoneNumber?: string | null;
}

export interface PassiveSkillsOverview {
  rules: PassiveSkillRule[];
  /** Detecciones automaticas del sistema, que se listan pero no se programan. */
  systemRules: PassiveSkillRule[];
}
