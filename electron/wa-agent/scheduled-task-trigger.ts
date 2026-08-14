import type { ScheduledTaskInfo } from '../task-scheduler';
import type { WhatsAppService } from '../whatsapp-service';
import type { AgentLoopOptions } from './types';
import { buildScheduledTaskPrompt, recordScheduledTaskResult } from './scheduled-task-prompt';

type RunAgentLoop = (
  jid: string,
  senderNumber: string,
  userMessage: string,
  isGroup?: boolean,
  groupPassiveHistory?: string,
  inlineMediaParts?: Array<{ inlineData: { mimeType: string; data: string } }>,
  options?: AgentLoopOptions,
) => Promise<string>;

/**
 * Ejecuta el prompt de una Skill pasiva y DEVUELVE el texto.
 *
 * Antes enviaba el resultado por WhatsApp aqui mismo. Eso dejaba el destino
 * cableado dentro de la ejecucion: una regla que el usuario quisiera oir solo
 * en la orbe habria llegado igualmente al telefono, y una que quisiera en ambos
 * habria llegado dos veces al anadirse la capa de entrega. Quien ejecuta ya no
 * decide por donde sale; eso es de `passive-skills/delivery.ts`.
 *
 * El fallo tampoco se envia: se devuelve como texto para que llegue por los
 * mismos canales que habria usado el resultado. Si se propagara, una rutina que
 * falla seria una rutina silenciosa.
 */
export async function handleScheduledWhatsAppTask(input: {
  waService: WhatsAppService;
  runAgentLoop: RunAgentLoop;
  jid: string;
  senderNumber: string;
  task: ScheduledTaskInfo;
}): Promise<string> {
  const prompt = String(input.task.prompt || '').trim();
  if (!prompt) return '';

  const wrappedPrompt = await buildScheduledTaskPrompt({
    waService: input.waService,
    senderNumber: input.senderNumber,
    task: input.task,
  });

  try {
    // `skipConfirmations`: el usuario autorizo la tarea al programarla, y no hay
    // nadie delante a quien volver a preguntar.
    return await input.runAgentLoop(input.jid, input.senderNumber, wrappedPrompt, false, '', [], {
      skipConfirmations: true,
    });
  } catch (err: any) {
    console.error('[SkillsPasivas] Error al ejecutar la rutina programada:', err);
    return `No pude completar la skill pasiva "${input.task.name || input.task.id}". ${err?.message || ''}`.trim();
  }
}

/**
 * Deja constancia del resultado en el historial de la conversacion de WhatsApp.
 * Solo tiene sentido cuando la entrega salio por ese canal: es ahi donde el
 * usuario podria preguntar por lo que se le acaba de mandar.
 */
export function recordScheduledTaskDelivery(input: {
  waService: WhatsAppService;
  jid: string;
  senderNumber: string;
  task: ScheduledTaskInfo;
  response: string;
}): void {
  recordScheduledTaskResult(input);
}
