import { GoogleGenerativeAI } from '@google/generative-ai';
import { GOOGLE_API_KEY, MODELS } from '../config';
import { PRIMARY_CHAT_PROMPT } from '../prompts/chat';
import { getApiKeyWithCache } from './api-keys';

export interface ConversationMessage {
  role: 'user' | 'model';
  text: string;
}

export interface StreamResult {
  stream: AsyncIterable<string>;
  sources: Promise<Array<{ uri: string; title: string }> | null>;
}

let genAI: GoogleGenerativeAI | null = null;
let currentApiKey: string | null = null;

async function getGenAI(): Promise<GoogleGenerativeAI> {
  // Try to get API key from database (user's key or system default)
  const dbApiKey = await getApiKeyWithCache('google');

  if (dbApiKey) {
    // If we have a new key or no instance yet, create/recreate
    if (!genAI || currentApiKey !== dbApiKey) {
      genAI = new GoogleGenerativeAI(dbApiKey);
      currentApiKey = dbApiKey;
      console.log('🔑 Using API key from database');
    }
    return genAI;
  }

  // Fallback to environment variable if DB key fails
  if (!genAI || currentApiKey !== GOOGLE_API_KEY) {
    if (!GOOGLE_API_KEY) {
       console.warn('⚠️ No API key found in DB or env vars. Chat may fail.');
    }
    genAI = new GoogleGenerativeAI(GOOGLE_API_KEY || '');
    currentApiKey = GOOGLE_API_KEY || '';
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

// Budget values for Gemini 2.5 (0 = off for Flash, 128-24576 range)
const THINKING_BUDGETS: Record<string, number> = {
  off: 0,
  minimal: 0,
  low: 1024,
  medium: 8192,
  high: 24576
};

/**
 * Envia un mensaje con streaming y contexto de conversacion.
 */
export async function sendMessageStream(
  message: string,
  conversationHistory: ConversationMessage[] = [],
  options?: {
    model?: string;
    thinking?: {
      id: string; // 'minimal' | 'low' | 'medium' | 'high'
      level?: string;
      budget?: number;
    };
    personalization?: {
      nickname?: string;
      occupation?: string;
      tone?: string;
      instructions?: string;
    };
    images?: string[];
    toolSystemPrompt?: string;
  }
): Promise<StreamResult> {
  const ai = await getGenAI();

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

  if (options?.toolSystemPrompt) {
    systemInstruction += `\n\n=== INSTRUCCIONES DE HERRAMIENTA ACTIVA ===\n${options.toolSystemPrompt}\n=====================================`;
  }

  const activeModelId = options?.model || MODELS.PRIMARY;

  // Configurar Thinking
  const generationConfig: any = {
    maxOutputTokens: 16384,
  };

  if (options?.thinking) {
    // Si el modelo es Gemini 2.0 Flash Thinking (exp) usa include_thoughts: true o logic similar?
    // Segun la extension para 'gemini-2.0-flash-thinking' usa 'thinkingLevel'??
    // Reviso la extension:
    // Gemini 3 (o flash thinking exp) usa 'level'.
    // Gemini 2.5 usa 'budget'.
    
    // Simplificacion basada en el objeto thinking pasado desde el UI:
    if (options.thinking.level) {
      generationConfig.thinkingConfig = {
        thinkingLevel: options.thinking.level
      };
    } else if (options.thinking.budget !== undefined) {
      if (options.thinking.budget > 0) {
        generationConfig.thinkingConfig = {
          thinkingBudget: options.thinking.budget
        };
      }
    }
  }

  // Crear modelo con Google Search
  const model = ai.getGenerativeModel({
    model: activeModelId,
    systemInstruction,
    tools: [{ googleSearch: {} } as any],
  });

  // Construir historial
  const history = buildGeminiHistory(conversationHistory);

  // Iniciar chat session con historial
  const chatSession = model.startChat({
    history,
    generationConfig,
  });

  // Construir contenido del mensaje (texto + imagenes opcionales)
  let messageContent: any = message;

  if (options?.images && options.images.length > 0) {
    const imageParts = options.images
      .map(imgBase64 => {
        const match = imgBase64.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
        if (match) {
          return { inlineData: { mimeType: match[1], data: match[2] } };
        }
        return null;
      })
      .filter(Boolean);

    if (imageParts.length > 0) {
      messageContent = [message, ...imageParts];
    }
  }

  // Enviar mensaje con streaming
  const result = await chatSession.sendMessageStream(messageContent);

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
 * Optimiza un prompt para un modelo de IA destino.
 */
export async function optimizePrompt(
  originalPrompt: string,
  target: 'chatgpt' | 'claude' | 'gemini'
): Promise<string> {
  const { buildOptimizationPrompt } = await import('../prompts/prompt-optimizer');
  const ai = await getGenAI();
  const model = ai.getGenerativeModel({ model: MODELS.PRO });
  const prompt = buildOptimizationPrompt(originalPrompt, target);
  const result = await model.generateContent(prompt);
  return result.response.text();
}

/**
 * Resetear el cliente (si cambia la API key).
 */
export function resetClient() {
  genAI = null;
}
