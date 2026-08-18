import type { GoogleGenerativeAI } from '@google/generative-ai';
import type { WhatsAppService } from '../whatsapp-service';
import { voiceCallSessions } from '../voice-call/session-store';
import { whatsAppVoiceSessionId } from './voice-delivery';
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
    forceVoice: boolean,
  ) => Promise<void>;
}): Promise<void> {
  try {
    const transcription = await transcribeWhatsAppAudio(params.getGenAI(), params.audioBuffer);
    if (!transcription || !transcription.trim()) {
      await params.waService.sendText(params.jid, 'No pude entender el audio. Podrias repetirlo o escribirlo?');
      return;
    }

    console.log(`[WhatsApp Agent] Audio transcribed: "${transcription}"`);
    params.waService.recordHistory({
      direction: 'system',
      kind: 'transcription',
      jid: params.jid,
      senderNumber: params.senderNumber,
      groupJid: params.isGroup ? params.jid : null,
      isGroup: params.isGroup,
      text: transcription,
      source: 'whatsapp-agent',
      metadata: { derivedFrom: 'audio' },
    });

    // Hablarle abre la llamada. En grupo no: una respuesta hablada quedaria
    // audible para todos los participantes sin que ninguno la pidiera.
    if (!params.isGroup) {
      voiceCallSessions.open(
        'whatsapp',
        whatsAppVoiceSessionId(params.jid, params.senderNumber),
        'voice-message',
      );
    }

    await params.handleTextMessage(
      params.jid,
      params.senderNumber,
      transcription,
      params.isGroup,
      params.groupPassiveHistory,
      !params.isGroup,
    );
  } catch (err: any) {
    console.error('[WhatsApp Agent] Audio error:', err);
    await params.waService.sendText(params.jid, 'No pude procesar el audio. Intenta enviar un mensaje de texto.');
  }
}
