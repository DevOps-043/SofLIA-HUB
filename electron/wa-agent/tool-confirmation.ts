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
  const emoji = params.toolName === 'delete_item' ? 'Eliminar' : 'Confirmar';
  await params.waService.sendText(
    params.jid,
    `${emoji} *Confirmacion requerida*\n\n${params.description}\n\nConfirmas? Responde *SI* para proceder o cualquier otra cosa para cancelar.`,
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
