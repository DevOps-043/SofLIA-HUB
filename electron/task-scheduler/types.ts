import type { SkillChannel } from '../../src/shared/skills/types';

export type ScheduledTaskKind =
  | 'legacy_prompt'
  | 'passive_prompt'
  | 'passive_skill';

/**
 * Como se ejecuta la tarea. Solo queda `agent_prompt`: al retirarse el motor de
 * flujos, una Skill pasiva es siempre un turno del agente con las instrucciones
 * de la Skill anexadas. No hay un segundo motor que ejecutar.
 */
export type ScheduledTaskExecutionMode = 'agent_prompt';

export interface ScheduledTaskInfo {
  id: string;
  cronExpression: string;
  prompt: string;
  phoneNumber: string;
  createdAt: string;
  updatedAt?: string;
  lastRun?: string;
  runOnce?: boolean;
  scheduledFor?: string | null;
  name?: string;
  description?: string;
  scheduleLabel?: string;
  source?: 'legacy' | 'chat' | 'app';
  kind?: ScheduledTaskKind;
  executionMode?: ScheduledTaskExecutionMode;
  /** Skill del catalogo que ejecuta. Nulo = rutina libre. */
  skillId?: string | null;
  /** Canales por los que se entrega el resultado. Nunca vacio tras normalizar. */
  channels?: SkillChannel[];
  requestedBy?: string | null;
  passiveRuleId?: string | null;
  /**
   * Identificador del workflow que la creo, conservado SOLO para que revertir
   * esta version no pierda las programaciones ya migradas. No se escribe nuevo
   * y no se lee para decidir nada: `skillId` es la referencia vigente. Se
   * retira en la siguiente version.
   */
  workflowId?: string | null;
}

export interface ScheduledTaskCreateInput {
  id?: string;
  cronExpression: string;
  prompt: string;
  phoneNumber?: string;
  name?: string;
  description?: string;
  scheduleLabel?: string;
  source?: 'legacy' | 'chat' | 'app';
  kind?: ScheduledTaskKind;
  executionMode?: ScheduledTaskExecutionMode;
  skillId?: string | null;
  channels?: SkillChannel[];
  requestedBy?: string | null;
  passiveRuleId?: string | null;
  createdAt?: string;
  lastRun?: string;
  runOnce?: boolean;
  scheduledFor?: string | null;
}
