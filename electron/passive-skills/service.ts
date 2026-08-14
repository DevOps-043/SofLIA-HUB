import { normalizeChannels } from '../../src/shared/skills/channels';
import type { SkillChannel } from '../../src/shared/skills/types';
import type { ScheduledTaskInfo, TaskScheduler } from '../task-scheduler';
import { systemSkillsFor } from '../skill-catalog/system-skills-store';
import { describeCron } from './cron-description';
import { systemPassiveRules } from './system-rules';
import type {
  PassiveSkillRule,
  PassiveSkillsOverview,
  SavePassiveSkillInput,
} from './types';

/**
 * Skills pasivas: alta, baja y consulta.
 *
 * NO tiene almacen propio. Delega en el `TaskScheduler`, que ya persiste el
 * cron y lo levanta al arrancar; una `PassiveSkillRule` es la proyeccion de un
 * `ScheduledTaskInfo`. Crear un almacen nuevo habria obligado a migrar datos de
 * usuario con riesgo de perder programaciones, sin ganar nada: lo que cambio es
 * a que apunta la tarea y a donde entrega, no como se programa.
 */

export interface PassiveSkillsDependencies {
  taskScheduler: TaskScheduler;
  /**
   * Si la deteccion automatica de reuniones esta operativa. Se inyecta porque
   * depende de las capacidades de Google, que este modulo no resuelve.
   */
  isMeetingDetectionAvailable?: () => boolean;
}

export class PassiveSkillsService {
  constructor(private readonly deps: PassiveSkillsDependencies) {}

  async getOverview(): Promise<PassiveSkillsOverview> {
    const nombres = await this.skillNames();
    const rules = this.deps.taskScheduler
      .getTasks()
      .filter(isPassiveTask)
      .map((task) => mapTaskToRule(task, nombres))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    return {
      rules,
      systemRules: systemPassiveRules(this.deps.isMeetingDetectionAvailable?.() ?? false),
    };
  }

  async saveRule(input: SavePassiveSkillInput): Promise<PassiveSkillRule> {
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

    // Una regla sin destino se ejecutaria en silencio: el usuario no sabria
    // nunca que corrio ni que produjo. Es un fallo de configuracion, no una
    // eleccion util, asi que se rechaza en vez de guardarse inerte.
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

    return mapTaskToRule(task, await this.skillNames());
  }

  deleteRule(ruleId: string): boolean {
    return this.deps.taskScheduler.deleteTask(String(ruleId || '').trim());
  }

  /**
   * Nombres de las Skills del catalogo, para mostrar la regla con el nombre que
   * el usuario reconoce. Un fallo de catalogo no puede dejar la lista sin
   * cargar: se cae al identificador.
   */
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

/**
 * La deteccion automatica de reuniones no se programa: corre sola. Se rechaza
 * al guardar para que el usuario no cree una rutina que duplicaria el trabajo
 * del servicio que ya la ejecuta.
 */
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
