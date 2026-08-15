import { getHubDbClient } from '../hub-db-client';
import { normalizeChannels } from '../../src/shared/skills/channels';
import type { SkillChannel } from '../../src/shared/skills/types';
import type { PassiveSkillRule } from './types';

/**
 * Persistencia de las Skills pasivas en `public.passive_skills`.
 *
 * Es la FUENTE DE VERDAD. El JSON del planificador quedo como cache de arranque:
 * `node-cron` tiene que levantar las programaciones sin depender de la red, y
 * una rutina que no se ejecuta no avisa de que no se ejecuto.
 *
 * Todas las operaciones devuelven `null` (o `false`) ante un fallo en vez de
 * lanzar: el llamador degrada a la cache, que es preferible a dejar al usuario
 * sin sus rutinas por una caida de red.
 *
 * El aislamiento real lo aplica RLS por `auth.uid()`; el filtro por `user_id`
 * de este modulo es una segunda barrera, no la principal. Requiere que main
 * opere con sesion (ver `main/hub-session.ts`).
 */

const COLUMNAS =
  'id, profile, skill_id, name, description, prompt, cron_expression, schedule_label, ' +
  'channels, run_once, scheduled_for, phone_number, source, requested_by, last_run_at, ' +
  'created_at, updated_at';

interface PassiveSkillRow {
  id: string;
  profile: string | null;
  skill_id: string | null;
  name: string;
  description: string | null;
  prompt: string;
  cron_expression: string;
  schedule_label: string | null;
  channels: unknown;
  run_once: boolean | null;
  scheduled_for: string | null;
  phone_number: string | null;
  source: string | null;
  requested_by: string | null;
  last_run_at: string | null;
  created_at: string;
  updated_at: string | null;
}

/** Perfil al que pertenece una regla. 'global' cuando no es de un contacto. */
export function profileOf(rule: Pick<PassiveSkillRule, 'phoneNumber'>): string {
  const telefono = String(rule.phoneNumber || '').replace(/\D/g, '');
  return telefono || 'global';
}

function toRule(row: PassiveSkillRow): PassiveSkillRule {
  return {
    id: row.id,
    skillId: row.skill_id,
    // El nombre del catalogo lo resuelve el servicio; aqui solo se transporta.
    skillName: row.skill_id ?? 'Rutina libre',
    name: row.name,
    description: row.description ?? '',
    prompt: row.prompt,
    scheduleLabel: row.schedule_label ?? row.cron_expression,
    cronExpression: row.cron_expression,
    runOnce: row.run_once === true,
    scheduledFor: row.scheduled_for,
    channels: normalizeChannels(row.channels) as SkillChannel[],
    source: row.source === 'chat' || row.source === 'app' ? row.source : 'legacy',
    status: 'active',
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
    lastRunAt: row.last_run_at,
    requestedBy: row.requested_by,
    phoneNumber: row.phone_number,
    reason: null,
  };
}

/** Reglas del usuario. `null` = no se pudo consultar (manda la cache). */
export async function listForUser(
  userId: string,
  profile?: string,
): Promise<PassiveSkillRule[] | null> {
  if (!userId) return null;
  try {
    let consulta = getHubDbClient()
      .from('passive_skills')
      .select(COLUMNAS)
      .eq('user_id', userId);
    if (profile) consulta = consulta.eq('profile', profile);

    const { data, error } = await consulta.order('updated_at', { ascending: false });
    if (error) {
      console.warn('[SkillsPasivas] No se pudieron leer las reglas:', error.message);
      return null;
    }
    return (data ?? []).map((row) => toRule(row as unknown as PassiveSkillRow));
  } catch (error) {
    console.warn('[SkillsPasivas] No se pudieron leer las reglas:', describe(error));
    return null;
  }
}

/** Alta o modificacion. `false` = no se pudo guardar en la base. */
export async function upsertRule(userId: string, rule: PassiveSkillRule): Promise<boolean> {
  if (!userId) return false;
  try {
    const { error } = await getHubDbClient()
      .from('passive_skills')
      .upsert(
        {
          user_id: userId,
          id: rule.id,
          profile: profileOf(rule),
          skill_id: rule.skillId,
          name: rule.name,
          description: rule.description || null,
          prompt: rule.prompt,
          cron_expression: rule.cronExpression,
          schedule_label: rule.scheduleLabel || null,
          channels: rule.channels,
          run_once: rule.runOnce === true,
          scheduled_for: rule.scheduledFor,
          phone_number: rule.phoneNumber,
          source: rule.source === 'chat' || rule.source === 'app' ? rule.source : 'legacy',
          requested_by: rule.requestedBy,
          last_run_at: rule.lastRunAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,id' },
      );
    if (error) {
      console.warn('[SkillsPasivas] No se pudo guardar la regla:', error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.warn('[SkillsPasivas] No se pudo guardar la regla:', describe(error));
    return false;
  }
}

export async function removeRule(userId: string, ruleId: string): Promise<boolean> {
  if (!userId || !ruleId) return false;
  try {
    const { error } = await getHubDbClient()
      .from('passive_skills')
      .delete()
      .eq('user_id', userId)
      .eq('id', ruleId);
    if (error) {
      console.warn('[SkillsPasivas] No se pudo eliminar la regla:', error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.warn('[SkillsPasivas] No se pudo eliminar la regla:', describe(error));
    return false;
  }
}

/**
 * Inserta reglas migradas sin pisar lo que ya exista.
 *
 * `ignoreDuplicates` es lo que hace idempotente la migracion desde el espejo
 * global: repetirla no duplica ni revierte una regla que el usuario ya edito.
 */
export async function insertMigrated(userId: string, rules: PassiveSkillRule[]): Promise<number> {
  if (!userId || rules.length === 0) return 0;
  try {
    const { data, error } = await getHubDbClient()
      .from('passive_skills')
      .upsert(
        rules.map((rule) => ({
          user_id: userId,
          id: rule.id,
          profile: profileOf(rule),
          skill_id: rule.skillId,
          name: rule.name,
          description: rule.description || null,
          prompt: rule.prompt,
          cron_expression: rule.cronExpression,
          schedule_label: rule.scheduleLabel || null,
          channels: rule.channels,
          run_once: rule.runOnce === true,
          scheduled_for: rule.scheduledFor,
          phone_number: rule.phoneNumber,
          source: rule.source === 'chat' || rule.source === 'app' ? rule.source : 'legacy',
          requested_by: rule.requestedBy,
          last_run_at: rule.lastRunAt,
        })),
        { onConflict: 'user_id,id', ignoreDuplicates: true },
      )
      .select('id');
    if (error) {
      console.warn('[SkillsPasivas] No se pudieron migrar las reglas:', error.message);
      return 0;
    }
    return (data ?? []).length;
  } catch (error) {
    console.warn('[SkillsPasivas] No se pudieron migrar las reglas:', describe(error));
    return 0;
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
