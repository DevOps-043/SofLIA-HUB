import { randomUUID } from 'node:crypto';

import { normalizeChannels } from '../../src/shared/skills/channels';
import type { SkillChannel } from '../../src/shared/skills/types';
import type { ScheduledTaskInfo, ScheduledTaskKind } from './types';

/**
 * Identificador de Skill que sustituye a cada workflow retirado.
 *
 * Las programaciones que el usuario ya tenia guardadas apuntan al workflow por
 * su identificador antiguo. Traducirlas al cargar es lo que hace que sobrevivan
 * a la actualizacion sin que el usuario tenga que volver a crearlas.
 */
const SKILL_POR_WORKFLOW: Readonly<Record<string, string>> = {
  correo: 'sistema:correo',
  agenda: 'sistema:agenda',
  seguimiento: 'sistema:seguimiento',
  drive: 'sistema:drive',
  actualizacion_equipo: 'sistema:actualizacion-equipo',
  pc: 'sistema:pc',
  // 'reuniones' no se traduce: su comportamiento pasivo es una deteccion
  // automatica del sistema, que nunca se programo a mano y sigue corriendo en
  // su propio servicio.
};

function resolveSkillId(task: Partial<ScheduledTaskInfo>): string | null {
  const declarado = task.skillId ? String(task.skillId).trim() : '';
  if (declarado) return declarado;

  const heredado = task.workflowId ? String(task.workflowId).trim() : '';
  return SKILL_POR_WORKFLOW[heredado] ?? null;
}

/**
 * Canales de entrega. Una programacion creada antes de que existieran no
 * declara ninguno, y quedarse sin destino la volveria silenciosa: se entrega
 * por el canal desde el que se creo, que es el telefono si lo tiene y la
 * computadora si no.
 */
function resolveChannels(task: Partial<ScheduledTaskInfo>): SkillChannel[] {
  const declarados = normalizeChannels(task.channels);
  if (declarados.length > 0) return declarados;
  return String(task.phoneNumber || '').trim() ? ['whatsapp'] : ['escritorio'];
}

function resolveKind(task: Partial<ScheduledTaskInfo>, skillId: string | null): ScheduledTaskKind {
  // `passive_workflow` es el nombre anterior de lo que hoy es `passive_skill`.
  if (task.kind === 'passive_skill' || (task.kind as string) === 'passive_workflow') return 'passive_skill';
  if (task.kind === 'passive_prompt') return 'passive_prompt';
  if (task.kind === 'legacy_prompt') return 'legacy_prompt';
  return skillId ? 'passive_skill' : 'legacy_prompt';
}

export function normalizeScheduledTask(task: Partial<ScheduledTaskInfo>): ScheduledTaskInfo {
  const createdAt = String(task.createdAt || new Date().toISOString());
  const skillId = resolveSkillId(task);
  return {
    id: String(task.id || randomUUID()),
    cronExpression: String(task.cronExpression || '').trim(),
    prompt: String(task.prompt || '').trim(),
    phoneNumber: String(task.phoneNumber || '').trim(),
    createdAt,
    updatedAt: String(task.updatedAt || createdAt),
    lastRun: task.lastRun ? String(task.lastRun) : undefined,
    runOnce: task.runOnce === true,
    scheduledFor: task.scheduledFor ? String(task.scheduledFor).trim() : null,
    name: task.name ? String(task.name).trim() : undefined,
    description: task.description ? String(task.description).trim() : undefined,
    scheduleLabel: task.scheduleLabel ? String(task.scheduleLabel).trim() : undefined,
    source: task.source === 'chat' || task.source === 'app' ? task.source : 'legacy',
    kind: resolveKind(task, skillId),
    // Unico modo restante: el motor de flujos que ejecutaba el otro ya no existe.
    executionMode: 'agent_prompt',
    skillId,
    channels: resolveChannels(task),
    requestedBy: task.requestedBy ? String(task.requestedBy).trim() : null,
    passiveRuleId: task.passiveRuleId ? String(task.passiveRuleId).trim() : null,
    // Se conserva tal cual para que revertir esta version no pierda la tarea.
    workflowId: task.workflowId ? String(task.workflowId).trim() : null,
  };
}
