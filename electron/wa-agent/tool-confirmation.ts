import type { WhatsAppService } from '../whatsapp-service';
import type { PendingConfirmation } from './types';

export async function requestWhatsAppToolConfirmation(params: {
  pendingConfirmations: Map<string, PendingConfirmation>;
  waService: WhatsAppService;
  jid: string;
  senderNumber: string;
  toolName: string;
  description: string;
  args: Record<string, any>;
}): Promise<boolean> {
  await params.waService.sendText(
    params.jid,
    `*Confirmacion requerida*\n\n${params.description}\n\nResponde *SI* para proceder. Si no pediste esta accion, responde *NO* o ignora este mensaje para cancelar.`,
  );

  return new Promise<boolean>((resolve) => {
    const timeout = setTimeout(() => {
      params.pendingConfirmations.delete(params.senderNumber);
      resolve(false);
      void params.waService.sendText(params.jid, 'Tiempo de confirmacion agotado. Accion cancelada.');
    }, 60000);

    params.pendingConfirmations.set(params.senderNumber, {
      toolName: params.toolName,
      args: params.args,
      resolve,
      timeout,
    });
  });
}
