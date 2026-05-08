import type { WhatsAppService } from '../whatsapp-service';

export async function sendDailyBriefingWhatsApp(
  waService: WhatsAppService,
  ownerNumber: string,
  summary: string,
): Promise<boolean> {
  if (!waService?.isConnected()) {
    console.warn('[DailyBriefing] No se pudo enviar el resumen porque WhatsApp no esta conectado.');
    return false;
  }

  const jid = ownerNumber.includes('@') ? ownerNumber : `${ownerNumber.replace(/\D/g, '')}@s.whatsapp.net`;
  const waServiceAny = waService as any;
  if (typeof waServiceAny.sendProactiveMessage === 'function') {
    await waServiceAny.sendProactiveMessage(ownerNumber, summary);
  } else {
    await waService.sendText(jid, summary);
  }

  console.log(`[DailyBriefing] Resumen ejecutivo diario enviado con exito a ${ownerNumber}`);
  return true;
}
