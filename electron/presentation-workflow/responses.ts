import type { WhatsAppService } from '../whatsapp-service';
import * as msg from './messages';

export async function requestMissingData(
  waService: WhatsAppService,
  jid: string,
  scheduleTimer: () => void,
): Promise<boolean> {
  scheduleTimer();
  await waService.sendText(jid, msg.MISSING_DATA_CONTEXT_MESSAGE);
  await waService.sendText(jid, msg.MISSING_DATA_MESSAGE);
  return true;
}

export async function replyAndKeep(
  waService: WhatsAppService,
  jid: string,
  message: string,
  clearTimer: () => void,
): Promise<boolean> {
  clearTimer();
  await waService.sendText(jid, message);
  return true;
}
