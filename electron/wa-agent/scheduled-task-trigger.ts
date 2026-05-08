import type { ScheduledTaskInfo } from '../task-scheduler';
import type { WhatsAppService } from '../whatsapp-service';
import type { AgentLoopOptions } from './types';

type RunAgentLoop = (
  jid: string,
  senderNumber: string,
  userMessage: string,
  isGroup?: boolean,
  groupPassiveHistory?: string,
  inlineMediaParts?: Array<{ inlineData: { mimeType: string; data: string } }>,
  options?: AgentLoopOptions,
) => Promise<string>;

export async function handleScheduledWhatsAppTask(input: {
  waService: WhatsAppService;
  runAgentLoop: RunAgentLoop;
  jid: string;
  senderNumber: string;
  task: ScheduledTaskInfo;
}): Promise<void> {
  const prompt = String(input.task.prompt || '').trim();
  if (!prompt) return;

  const wrappedPrompt = [
    'Esta es una automatizacion pasiva ya programada.',
    'No la vuelvas a programar ni uses task_scheduler.',
    'Ejecuta ahora la instruccion y responde por WhatsApp con el resultado.',
    '',
    `Solicitud original: ${prompt}`,
  ].join('\n');

  try {
    const response = await input.runAgentLoop(input.jid, input.senderNumber, wrappedPrompt, false, '', [], {
      skipConfirmations: true,
    });
    if (response) await input.waService.sendText(input.jid, response);
  } catch (err: any) {
    console.error('[WhatsApp Agent] Scheduled task error:', err);
    await input.waService.sendText(
      input.jid,
      `No pude completar la automatizacion pasiva "${input.task.name || input.task.id}". ${err?.message || ''}`.trim(),
    );
  }
}
