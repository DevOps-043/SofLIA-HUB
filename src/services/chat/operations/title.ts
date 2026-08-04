import { MODELS } from '../../../config';
import { getGenAI } from '../../gemini-chat/client';
import { withGeminiTimeout } from '../../gemini-chat/resilience';
import type { ChatMessage } from '../types';

const FALLBACK_TITLE = 'Nueva conversacion';
export const PENDING_MODEL_TITLE = 'Nombrando...';
const GENERIC_INITIAL_TITLE = 'Conversacion inicial';
const LINK_TITLE = 'Enlace compartido';
const MAX_TITLE_LENGTH = 44;
const MAX_TITLE_WORDS = 5;

const STOP_WORDS = new Set([
  'a',
  'al',
  'algo',
  'algun',
  'alguna',
  'algunas',
  'algunos',
  'ayuda',
  'ayudame',
  'como',
  'con',
  'cual',
  'cuales',
  'cuando',
  'dame',
  'de',
  'del',
  'el',
  'en',
  'entre',
  'eres',
  'es',
  'esta',
  'estan',
  'este',
  'esto',
  'estos',
  'favor',
  'haz',
  'hazme',
  'hay',
  'hello',
  'hi',
  'hola',
  'la',
  'las',
  'le',
  'lo',
  'los',
  'me',
  'mi',
  'mis',
  'necesito',
  'o',
  'para',
  'por',
  'porfa',
  'puede',
  'puedes',
  'puedo',
  'que',
  'quiero',
  'se',
  'sobre',
  'son',
  'su',
  'sus',
  'te',
  'tu',
  'tus',
  'un',
  'una',
  'unas',
  'unos',
  'y',
]);

export function generateTitle(messages: ChatMessage[]): string {
  const firstUserMessage = messages.find((message) => message.role === 'user' && message.text.trim().length > 0);
  if (!firstUserMessage) return FALLBACK_TITLE;

  return buildShortTitle(firstUserMessage.text);
}

export async function generateTitleWithModel(messages: ChatMessage[]): Promise<string> {
  const firstUserMessage = messages.find((message) => message.role === 'user' && message.text.trim().length > 0);
  if (!firstUserMessage) return FALLBACK_TITLE;

  try {
    const ai = await getGenAI();
    const model = ai.getGenerativeModel({
      model: MODELS.FALLBACK,
      generationConfig: {
        maxOutputTokens: 24,
        temperature: 0.25,
      },
    });
    const prompt = buildModelTitlePrompt(messages);
    const result = await withGeminiTimeout(
      'Gemini chat title',
      () => model.generateContent(prompt),
      8000,
    );
    return sanitizeModelTitle(result.response.text(), firstUserMessage.text);
  } catch (error) {
    console.warn('[chat-title] No se pudo generar titulo con modelo, usando fallback local:', error);
    return generateTitle(messages);
  }
}

function buildShortTitle(text: string): string {
  const words = extractWords(text);
  if (words.length === 0) return hasLink(text) ? LINK_TITLE : FALLBACK_TITLE;

  const meaningfulWords = words.filter((word) => !STOP_WORDS.has(normalizeWord(word)));
  if (meaningfulWords.length === 0) return GENERIC_INITIAL_TITLE;

  const selectedWords = meaningfulWords.length >= 2 ? meaningfulWords : words;
  return trimTitle(capitalizeFirst(selectedWords.slice(0, MAX_TITLE_WORDS).join(' ')));
}

function buildModelTitlePrompt(messages: ChatMessage[]): string {
  const transcript = messages
    .filter((message) => message.text.trim().length > 0)
    .slice(0, 4)
    .map((message) => `${message.role === 'user' ? 'Usuario' : 'SofLIA'}: ${message.text.trim()}`)
    .join('\n');

  return [
    'Crea un titulo corto en espanol para esta conversacion de Pulse Hub.',
    'Reglas estrictas:',
    '- Usa 2 a 5 palabras.',
    '- No copies literalmente el primer mensaje del usuario.',
    '- Si solo hay saludo o no hay tema claro, responde: Conversacion inicial',
    '- Sin comillas, sin emojis, sin punto final, sin explicaciones.',
    '',
    transcript,
  ].join('\n');
}

function extractWords(text: string): string[] {
  return text
    .replace(/https?:\/\/\S+|www\.\S+/gi, ' ')
    .replace(/[`*_>#\[\]{}()]/g, ' ')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function hasLink(text: string): boolean {
  return /https?:\/\/\S+|www\.\S+/i.test(text);
}

function normalizeWord(word: string): string {
  return word.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeTitle(title: string): string {
  return normalizeWord(title).replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function sanitizeModelTitle(rawTitle: string, firstUserText: string): string {
  const cleaned = rawTitle
    .replace(/^```(?:json|text)?/i, '')
    .replace(/```$/i, '')
    .replace(/^["'`]+|["'`.]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return generateTitle([{ id: 'fallback', role: 'user', text: firstUserText, timestamp: Date.now() }]);

  const normalizedTitle = normalizeTitle(cleaned);
  const normalizedFirstMessage = normalizeTitle(firstUserText);
  if (!normalizedTitle || normalizedTitle === normalizedFirstMessage) {
    return generateTitle([{ id: 'fallback', role: 'user', text: firstUserText, timestamp: Date.now() }]);
  }

  return trimTitle(capitalizeFirst(cleaned));
}

function capitalizeFirst(text: string): string {
  if (text.length === 0) return FALLBACK_TITLE;
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

function trimTitle(title: string): string {
  if (title.length <= MAX_TITLE_LENGTH) return title;

  const words = title.split(/\s+/);
  const trimmedWords: string[] = [];
  for (const word of words) {
    const candidate = [...trimmedWords, word].join(' ');
    if (candidate.length > MAX_TITLE_LENGTH) break;
    trimmedWords.push(word);
  }

  if (trimmedWords.length > 0) return trimmedWords.join(' ');
  return title.slice(0, MAX_TITLE_LENGTH).trim();
}
