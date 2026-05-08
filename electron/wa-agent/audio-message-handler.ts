import type { GoogleGenerativeAI } from '@google/generative-ai';
import type { WhatsAppService } from '../whatsapp-service';
import { transcribeWhatsAppAudio } from './audio-transcription';

export async function handleWhatsAppAudioMessage(params: {
  waService: WhatsAppService;
  getGenAI: () => GoogleGenerativeAI;
  jid: string;
  senderNumber: string;
  audioBuffer: Buffer;
  isGroup: boolean;
  groupPassiveHistory: string;
  handleTextMessage: (
    jid: string,
    senderNumber: string,
    text: string,
    isGroup: boolean,
    groupPassiveHistory: string,
  ) => Promise<void>;
}): Promise<void> {
  try {
    const transcription = await transcribeWhatsAppAudio(params.getGenAI(), params.audioBuffer);
    if (!transcription || !transcription.trim()) {
      await params.waService.sendText(params.jid, 'No pude entender el audio. Podrias repetirlo o escribirlo?');
      return;
    }

    console.log(`[WhatsApp Agent] Audio transcribed: "${transcription}"`);
    await params.handleTextMessage(
      params.jid,
      params.senderNumber,
      transcription,
      params.isGroup,
      params.groupPassiveHistory,
    );
  } catch (err: any) {
    console.error('[WhatsApp Agent] Audio error:', err);
    await params.waService.sendText(params.jid, 'No pude procesar el audio. Intenta enviar un mensaje de texto.');
  }
}
