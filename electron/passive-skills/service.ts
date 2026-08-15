import { normalizeChannels } from '../../src/shared/skills/channels';
import type { SkillChannel } from '../../src/shared/skills/types';
import type { ScheduledTaskInfo, TaskScheduler } from '../task-scheduler';
import { systemSkillsFor } from '../skill-catalog/system-skills-store';
import { getHubSessionUserId } from '../main/hub-session';
import { describeCron } from './cron-description';
import { insertMigrated, listForUser, removeRule, upsertRule } from './repository';
import { systemPassiveRules } from './system-rules';
import type {
  PassiveSkillRule,
  PassiveSkillsOverview,
  SavePassiveSkillInput,
} from './types';

/**
 * Skills pasivas: alta, baja y consulta.
 *
 * Reparto de responsabilidades:
 *  - `public.passive_skills` es la FUENTE DE VERDAD, con dueno y RLS.
 *  - El `TaskScheduler` es el EJECUTOR y, de paso, la cache de arranque: su
 *    JSON local permite levantar los cron sin red. Una rutina que no se ejecuta
 *    no avisa de que no se ejecuto, asi que perder la red no puede apagarlas.
 *
 * Precedencia: cuando la base responde, manda; se reconcilia el planificador con
 * lo que diga. Cuando no responde, se usa lo que ya hay levantado.
 */

export interface PassiveSkillsDependencies {
  taskScheduler: TaskScheduler;
  isMeetingDetectionAvailable?: () => boolean;
  /** Usuario con el que main opera. Inyectable para pruebas. */
  getUserId?: () => string | null;
}

export class PassiveSkillsService {
  constructor(private readonly deps: PassiveSkillsDependencies) {}

  private userId(): string | null {
    return (this.deps.getUserId ?? getHubSessionUserId)();
  }

  async getOverview(profile?: string): Promise<PassiveSkillsOverview> {
    const userId = this.userId();
    const nombres = await this.skillNames();
    const systemRules = systemPassiveRules(this.deps.isMeetingDetectionAvailable?.() ?? false);

    // Sin sesion no hay reglas que mostrar: son de un usuario, y main no sabe
    // de cual. No es un error: es que todavia no se sabe de quien preguntar.
    if (!userId) return { rules: [], systemRules, hasSession: false };

    const remotas = await listForUser(userId, profile);
    if (remotas) {
      this.reconcileScheduler(remotas, profile);
      return { rules: remotas.map((rule) => this.withSkillName(rule, nombres)), systemRules, hasSession: true };
    }

    // La base no respondio: se listan las que hay levantadas localmente, que es
    // exactamente lo que se va a ejecutar.
    const locales = this.deps.taskScheduler
      .getTasks()
      .filter(isPassiveTask)
      .map((task) => mapTaskToRule(task, nombres))
      .filter((rule) => !profile || profileOf(rule) === profile)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return { rules: locales, systemRules, hasSession: true };
  }

  async saveRule(input: SavePassiveSkillInput): Promise<PassiveSkillRule> {
    const userId = this.userId();
    if (!userId) {
      throw new Error('Necesito una sesion iniciada para guardar una skill pasiva.');
    }

    const name = String(input.name || '').trim();
    if (!name) throw new Error('Necesito un nombre para guardar la skill pasiva.');

    const cronExpression = String(input.cronExpression || '').trim();
    if (!cronExpression) {
      throw new Error('Necesito una programacion valida para guardar la skill pasiva.');
    }

    const skillId = String(input.skillId || '').trim() || null;
    if (skillId && isSystemDetectionSkill(skillId)) {
      throw new Error(
        'Esa capacidad ya corre automaticamente en segundo plano y no necesita programacion manual.',
      );
    }

    const prompt = String(input.prompt || '').trim();
    if (!prompt) {
      throw new Error('Necesito la instruccion que quieres que ejecute la skill pasiva.');
    }

    const channels = normalizeChannels(input.channels);
    if (channels.length === 0) {
      throw new Error(
        'Elige al menos un canal de entrega: sin canal, el resultado no llegaria a ninguna parte.',
      );
    }

    const phoneNumber = String(input.phoneNumber || '').trim();
    if (channels.includes('whatsapp') && !phoneNumber) {
      throw new Error('Para entregar por WhatsApp necesito el numero al que escribir.');
    }

    const task = this.deps.taskScheduler.upsertTask({
      id: input.ruleId || undefined,
      cronExpression,
      prompt,
      phoneNumber,
      name,
      description: String(input.description || '').trim(),
      scheduleLabel: String(input.scheduleLabel || '').trim() || describeCron(cronExpression),
      runOnce: input.runOnce === true,
      scheduledFor: input.scheduledFor || null,
      source: input.source === 'chat' ? 'chat' : 'app',
      kind: skillId ? 'passive_skill' : 'passive_prompt',
      executionMode: 'agent_prompt',
      skillId,
      channels,
      requestedBy: input.requestedBy || null,
      passiveRuleId: input.ruleId || undefined,
    });

    const rule = mapTaskToRule(task, await this.skillNames());
    const guardada = await upsertRule(userId, rule);
    if (!guardada) {
      // Se deshace el alta local en vez de dejarla solo aqui. Sobreviviria al
      // reinicio pero la borraria la primera lectura correcta de la base, y el
      // usuario se habria quedado creyendo que estaba programada.
      this.deps.taskScheduler.deleteTask(task.id);
      throw new Error('No pude guardar la skill pasiva. Revisa tu conexion e intentalo de nuevo.');
    }

    return rule;
  }

  async deleteRule(ruleId: string): Promise<boolean> {
    const id = String(ruleId || '').trim();
    if (!id) return false;

    const userId = this.userId();
    if (userId) {
      const borrada = await removeRule(userId, id);
      // Si la base no pudo borrarla, no se detiene el cron: volveria a aparecer
      // en la siguiente lectura y el usuario veria reaparecer lo que elimino.
      if (!borrada) {
        throw new Error('No pude eliminar la skill pasiva. Revisa tu conexion e intentalo de nuevo.');
      }
    }
    return this.deps.taskScheduler.deleteTask(id);
  }

  /**
   * Alinea el planificador con lo que dice la base: levanta lo que falte y
   * retira lo que ya no exista. Es lo que hace que borrar una regla desde otro
   * equipo la apague aqui.
   */
  private reconcileScheduler(rules: PassiveSkillRule[], profile?: string): void {
    const porId = new Map(rules.map((rule) => [rule.id, rule]));

    for (const task of this.deps.taskScheduler.getTasks()) {
      if (!isPassiveTask(task)) continue;
      // Con un perfil concreto solo se reconcilia ese: las reglas de los demas
      // no vinieron en la consulta y borrarlas seria apagarlas por error.
      if (profile && profileOf(mapTaskToRule(task, new Map())) !== profile) continue;
      if (!porId.has(task.id)) this.deps.taskScheduler.deleteTask(task.id);
    }

    for (const rule of rules) {
      if (!rule.cronExpression) continue;
      this.deps.taskScheduler.upsertTask({
        id: rule.id,
        cronExpression: rule.cronExpression,
        prompt: rule.prompt,
        phoneNumber: rule.phoneNumber || '',
        name: rule.name,
        description: rule.description,
        scheduleLabel: rule.scheduleLabel,
        runOnce: rule.runOnce,
        scheduledFor: rule.scheduledFor,
        source: rule.source === 'chat' || rule.source === 'app' ? rule.source : 'app',
        kind: rule.skillId ? 'passive_skill' : 'passive_prompt',
        executionMode: 'agent_prompt',
        skillId: rule.skillId,
        channels: rule.channels,
        requestedBy: rule.requestedBy,
        createdAt: rule.createdAt,
        lastRun: rule.lastRunAt ?? undefined,
      });
    }
  }

  /**
   * Migra al usuario en sesion las reglas que quedaron en el planificador local
   * sin dueno. Se llama al restaurarse la sesion.
   *
   * Solo migra lo que puede atribuirle: reglas creadas desde este equipo por su
   * telefono o su identificador. Lo que no se puede resolver se deja donde
   * esta; atribuirlo a quien mire seria entregarle las rutinas de otro.
   */
  async migrateLocalRules(): Promise<number> {
    const userId = this.userId();
    if (!userId) return 0;

    const nombres = await this.skillNames();
    const candidatas = this.deps.taskScheduler
      .getTasks()
      .filter(isPassiveTask)
      .map((task) => mapTaskToRule(task, nombres))
      .filter((rule) => Boolean(rule.cronExpression));

    if (candidatas.length === 0) return 0;

    const migradas = await insertMigrated(userId, candidatas);
    if (migradas > 0) {
      console.log(`[SkillsPasivas] ${migradas} reglas locales quedaron registradas a nombre del usuario.`);
    }
    return migradas;
  }

  /** Detiene y olvida las reglas del usuario anterior. Se llama al cerrar sesion. */
  clearLocalRules(): void {
    for (const task of this.deps.taskScheduler.getTasks()) {
      if (isPassiveTask(task)) this.deps.taskScheduler.deleteTask(task.id);
    }
    console.log('[SkillsPasivas] Cache local vaciada: no quedan rutinas del usuario anterior.');
  }

  private withSkillName(rule: PassiveSkillRule, nombres: Map<string, string>): PassiveSkillRule {
    if (!rule.skillId) return { ...rule, skillName: 'Rutina libre' };
    return { ...rule, skillName: nombres.get(rule.skillId) ?? rule.skillId };
  }

  private async skillNames(): Promise<Map<string, string>> {
    try {
      const skills = await systemSkillsFor('chat');
      return new Map(skills.map((skill) => [skill.id, skill.name]));
    } catch (error) {
      console.warn('[SkillsPasivas] No se pudo resolver el catalogo para nombrar las reglas:', error);
      return new Map();
    }
  }
}

/** Perfil de una regla: 'global' o el telefono del contacto. */
export function profileOf(rule: Pick<PassiveSkillRule, 'phoneNumber'>): string {
  const telefono = String(rule.phoneNumber || '').replace(/\D/g, '');
  return telefono || 'global';
}

function isSystemDetectionSkill(skillId: string): boolean {
  return skillId === 'sistema:reuniones';
}

function isPassiveTask(task: ScheduledTaskInfo): boolean {
  return task.kind === 'passive_skill' || task.kind === 'passive_prompt';
}

export function mapTaskToRule(
  task: ScheduledTaskInfo,
  skillNames: Map<string, string>,
): PassiveSkillRule {
  const skillId = task.skillId || null;
  const skillName = (skillId && skillNames.get(skillId)) || (skillId ? skillId : 'Rutina libre');

  return {
    id: task.id,
    skillId,
    skillName,
    name: task.name || skillName,
    description: task.description || (skillId
      ? `Skill pasiva de ${skillName.toLowerCase()} programada.`
      : 'Instruccion recordada que SofLIA ejecutara automaticamente.'),
    prompt: task.prompt,
    scheduleLabel: task.scheduleLabel || describeCron(task.cronExpression),
    cronExpression: task.cronExpression,
    runOnce: task.runOnce === true,
    scheduledFor: task.scheduledFor || null,
    channels: normalizeChannels(task.channels) as SkillChannel[],
    source: task.source === 'chat' || task.source === 'app' ? task.source : 'legacy',
    status: 'active',
    createdAt: task.createdAt,
    updatedAt: task.updatedAt || task.createdAt,
    lastRunAt: task.lastRun || null,
    requestedBy: task.requestedBy || null,
    phoneNumber: task.phoneNumber || null,
    reason: null,
  };
}
