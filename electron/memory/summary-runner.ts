import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  SUMMARIZE_MODEL,
  SUMMARIZE_THRESHOLD,
} from './constants';
import { truncateToTokens } from './math';

export async function summarizeMemorySession(service: any, sessionKey: string): Promise<void> {
  if (!service.db || !service.apiKey) return;
  try {
    const lastSummary = service.db.prepare('SELECT period_end FROM summaries WHERE session_key = ? ORDER BY period_end DESC LIMIT 1').get(sessionKey) as { period_end: number } | undefined;
    const sinceTs = lastSummary?.period_end || 0;
    const messages = service.db.prepare(`
      SELECT role, content, timestamp FROM messages
      WHERE session_key = ? AND timestamp > ?
      ORDER BY timestamp ASC
    `).all(sessionKey, sinceTs) as Array<{ role: string; content: string; timestamp: number }>;
    if (messages.length < SUMMARIZE_THRESHOLD) return;

    console.log(`[MemoryService] Summarizing ${messages.length} messages for ${sessionKey}`);
    const summary = await service.callGeminiSummarize(formatConversationForSummary(messages));
    if (!summary) return;
    const periodStart = messages[0].timestamp;
    const periodEnd = messages[messages.length - 1].timestamp;
    service.db.prepare(`
      INSERT INTO summaries (session_key, phone_number, period_start, period_end, summary_text, message_count)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(sessionKey, sessionKey.includes(':') ? sessionKey.split(':').pop() : sessionKey, periodStart, periodEnd, summary, messages.length);
    console.log(`[MemoryService] Summary saved for ${sessionKey} (${messages.length} messages)`);
    service.appendMemoryCard(sessionKey, summary);
    await service.embedAndStoreChunks(sessionKey, summary, 'summary', periodStart, periodEnd);
    await service.embedConversationChunks(sessionKey, messages);
    service.emit('summary-created', { sessionKey, messageCount: messages.length });
  } catch (err: any) {
    console.error(`[MemoryService] summarizeSession error for ${sessionKey}:`, err.message);
  }
}

export async function callGeminiMemorySummarizer(apiKey: string, conversationText: string): Promise<string | null> {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: SUMMARIZE_MODEL, generationConfig: { maxOutputTokens: 350 } });
    const prompt = `Actúa como un agente que extrae los hechos clave de la sesión actual para guardarlos en la memoria a largo plazo.
Crea un resumen en formato 'Memory Card' (estrictamente menor a 350 tokens).
Captura temas, decisiones, archivos, fechas, preferencias, compromisos y resultados.
Usa Markdown estructurado, sé conciso y escribe en tercera persona.

CONVERSACIÓN:
${truncateToTokens(conversationText, 6000)}

MEMORY CARD:`;
    const result = await model.generateContent(prompt);
    return result.response.text().trim() || null;
  } catch (err: any) {
    console.error('[MemoryService] Gemini summarize error:', err.message);
    return null;
  }
}

function formatConversationForSummary(messages: Array<{ role: string; content: string; timestamp: number }>): string {
  return messages.map((message) => {
    const time = new Date(message.timestamp).toLocaleString('es-MX');
    return `[${time}] ${message.role === 'user' ? 'Usuario' : 'SofLIA'}: ${message.content}`;
  }).join('\n');
}
