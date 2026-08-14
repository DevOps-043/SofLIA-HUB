import type { PassiveSkillsService } from '../../passive-skills/service';
import type { SkillChannel } from '../../../src/shared/skills/types';

/**
 * Skills del catalogo que se reconocen en una peticion conversacional. Son las
 * que tienen un uso pasivo natural: revisar el correo, dar el briefing del dia
 * o seguir las reuniones. El resto se guarda como rutina libre, que es lo que
 * permite programar cualquier cosa sin ampliar esta lista.
 */
export type PassiveSkillId = 'sistema:correo' | 'sistema:agenda';

export interface PassiveSkillIntent {
  skillId?: PassiveSkillId;
  name: string;
  description: string;
  prompt: string;
  cronExpression: string;
  scheduleLabel: string;
  /** Canales pedidos explicitamente. Vacio = el canal desde el que se pidio. */
  channels: SkillChannel[];
}

export interface PassiveSkillRequestContext {
  passiveSkillsService: PassiveSkillsService | null;
  senderNumber: string;
  text: string;
  isGroup: boolean;
  /** Canal desde el que llega la peticion, destino por omision. */
  channel: SkillChannel;
}
