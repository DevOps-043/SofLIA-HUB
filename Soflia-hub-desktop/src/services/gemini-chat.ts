import { GoogleGenerativeAI } from '@google/generative-ai';
import { GOOGLE_API_KEY, MODELS } from '../config';
import { PRIMARY_CHAT_PROMPT } from '../prompts/chat';

export interface ConversationMessage {
  role: 'user' | 'model';
  text: string;
}

export interface StreamResult {
  stream: AsyncIterable<string>;
  sources: Promise<Array<{ uri: string; title: string }> | null>;
}

let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
  }
  return genAI;
}

/**
 * Prepara el historial de conversacion en formato Gemini.
 * Gemini requiere: empieza con 'user', alterna roles, no termina con 'user'.
 */
function buildGeminiHistory(history: ConversationMessage[]): Array<{ role: string; parts: Array<{ text: string }> }> {
  const MAX_HISTORY = 50;
  const trimmed = history.slice(-MAX_HISTORY);

  const raw = trimmed
    .filter(msg => msg.text && msg.text.trim().length > 0)
    .map(msg => ({
      role: msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.text }]
    }));

  // Quitar mensajes 'model' al inicio
  while (raw.length > 0 && raw[0].role === 'model') {
    raw.shift();
  }

  // Mergear mensajes consecutivos del mismo rol
  const clean: Array<{ role: string; parts: Array<{ text: string }> }> = [];
  for (const entry of raw) {
    if (clean.length === 0 || clean[clean.length - 1].role !== entry.role) {
      clean.push(entry);
    } else {
      clean[clean.length - 1].parts[0].text += '\n' + entry.parts[0].text;
    }
  }

  // Quitar ultimo si es 'user' (se envia como mensaje actual)
  if (clean.length > 0 && clean[clean.length - 1].role === 'user') {
    clean.pop();
  }

  return clean;
}

/**
 * Envia un mensaje con streaming y contexto de conversacion.
 */
export async function sendMessageStream(
  message: string,
  conversationHistory: ConversationMessage[] = [],
  options?: {
    personalization?: {
      nickname?: string;
      occupation?: string;
      tone?: string;
      instructions?: string;
    };
  }
): Promise<StreamResult> {
  const ai = getGenAI();

  // Construir system instruction
  let systemInstruction = PRIMARY_CHAT_PROMPT;

  if (options?.personalization) {
    const p = options.personalization;
    systemInstruction += `\n\n=== PERSONALIZACION DEL USUARIO ===
${p.nickname ? `Nombre: "${p.nickname}"` : ''}
${p.occupation ? `Ocupacion: ${p.occupation}` : ''}
${p.tone ? `Tono preferido: ${p.tone}` : ''}
${p.instructions ? `Instrucciones personalizadas: ${p.instructions}` : ''}
=====================================`;
  }

  // Crear modelo con Google Search
  const model = ai.getGenerativeModel({
    model: MODELS.PRIMARY,
    systemInstruction,
    tools: [{ googleSearch: {} } as any],
  });

  // Construir historial
  const history = buildGeminiHistory(conversationHistory);

  // Iniciar chat session con historial
  const chatSession = model.startChat({
    history,
    generationConfig: {
      maxOutputTokens: 16384,
    },
  });

  // Enviar mensaje con streaming
  const result = await chatSession.sendMessageStream(message);

  // Crear async iterable de strings
  const stream = (async function* () {
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        yield text;
      }
    }
  })();

  // Extraer sources (grounding metadata)
  const sources = (async () => {
    try {
      const response = await result.response;
      const metadata = response.candidates?.[0]?.groundingMetadata as any;
      if (metadata?.groundingChunks) {
        return metadata.groundingChunks
          .filter((chunk: any) => chunk.web)
          .map((chunk: any) => ({
            uri: chunk.web.uri,
            title: chunk.web.title || '',
          }));
      }
      return null;
    } catch {
      return null;
    }
  })();

  return { stream, sources };
}

/**
 * Resetear el cliente (si cambia la API key).
 */
export function resetClient() {
  genAI = null;
}
