import type { WhatsAppService } from '../whatsapp-service';
import { prepareWhatsAppMediaMessage } from './media-preparation';

type RunMediaAgentLoop = (
  jid: string,
  senderNumber: string,
  userMessage: string,
  isGroup: boolean,
  groupPassiveHistory: string,
  inlineMediaParts: Array<{ inlineData: { mimeType: string; data: string } }>,
  options?: Record<string, never>,
) => Promise<string>;

export async function handleWhatsAppMediaMessage(input: {
  waService: WhatsAppService;
  runAgentLoop: RunMediaAgentLoop;
  jid: string;
  senderNumber: string;
  buffer: Buffer;
  fileName: string;
  mimetype: string;
  text: string;
  isGroup: boolean;
  groupPassiveHistory: string;
}): Promise<void> {
  try {
    const prepared = await prepareWhatsAppMediaMessage(input.buffer, input.fileName, input.mimetype, input.text || '');
    console.log(`[WhatsApp Agent] Saved received file: ${prepared.savedPath} (${(input.buffer.length / 1024 / 1024).toFixed(2)} MB)`);
    if (!prepared.canAnalyzeInline && prepared.reason) {
      console.log(`[WhatsApp Agent] File too large or not analyzable inline (${prepared.reason}), saved to disk only: ${prepared.savedPath}`);
    }
    console.log(`[WhatsApp Agent] Processing media: ${input.fileName} (${input.mimetype}), inline: ${prepared.canAnalyzeInline}, caption: "${input.text?.slice(0, 60) || 'none'}"`);

    const response = await input.runAgentLoop(
      input.jid,
      input.senderNumber,
      prepared.userText,
      input.isGroup,
      input.groupPassiveHistory,
      prepared.inlineMediaParts,
      {},
    );
    if (response) await input.waService.sendText(input.jid, response);
  } catch (err: any) {
    console.error('[WhatsApp Agent] Media error:', err);
    await input.waService.sendText(input.jid, 'No pude procesar el archivo. Intenta de nuevo o envia un mensaje de texto.');
  }
}
