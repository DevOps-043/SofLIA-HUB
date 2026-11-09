import type OpenAI from 'openai';
import { transcribeAudio } from '../ai-provider/transcription';

export function transcribeChannelAudio(ai: OpenAI, audio: Buffer, mimetype = 'audio/ogg'): Promise<string> {
  return transcribeAudio(ai, audio, mimetype);
}

export function transcribeWhatsAppAudio(ai: OpenAI, audio: Buffer): Promise<string> {
  return transcribeChannelAudio(ai, audio, 'audio/ogg');
}
