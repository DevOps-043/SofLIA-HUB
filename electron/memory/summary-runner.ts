import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  SUMMARIZE_MODEL,
  SUMMARIZE_THRESHOLD,
} from './constants';
import { truncateToTokens } from './math';
import { phoneOwnerKey } from './scope';
import { extractAndSaveSkills } from './skills-extractor';

const FACT_CATEGORIES = ['preferencia', 'contexto', 'persona', 'compromiso'] as const;

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
    // Extraer hechos estructurados del resumen para memoria de largo plazo
    const phoneNumber = sessionKey.includes(':') ? sessionKey.split(':').pop()! : sessionKey;
    extractAndSaveFacts(service, phoneNumber, summary).catch((err: any) =>
      console.warn('[MemoryService] Auto-fact extraction failed (no bloqueante):', err.message),
    );
    // Aprendizaje autónomo de skills (conocimiento que personaliza). El ownerKey
    // REAL viaja en los mensajes (columna owner_key), correcto para cualquier
    // superficie (chat/WhatsApp/desktop); si falta, se deriva del telefono.
    const ownerKey = resolveSessionOwnerKey(service, sessionKey, phoneNumber);
    extractAndSaveSkills(service, ownerKey, summary, ownerKindLabel(ownerKey)).catch((err: any) =>
      console.warn('[MemoryService] Auto-skill extraction failed (no bloqueante):', err.message),
    );
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

/** Owner real de la sesion (columna owner_key de sus mensajes); fallback al telefono. */
function resolveSessionOwnerKey(service: any, sessionKey: string, phoneNumber: string): string {
  try {
    const row = service.db.prepare(
      'SELECT owner_key FROM messages WHERE session_key = ? AND owner_key IS NOT NULL ORDER BY timestamp DESC LIMIT 1',
    ).get(sessionKey) as { owner_key: string } | undefined;
    if (row?.owner_key) return row.owner_key;
  } catch {
    // fallback abajo
  }
  return phoneOwnerKey(phoneNumber);
}

/** Etiqueta de origen para 'source' de la skill segun el tipo de owner. */
function ownerKindLabel(ownerKey: string): string {
  if (ownerKey.startsWith('user:')) return 'app';
  if (ownerKey.startsWith('phone:')) return 'whatsapp';
  return 'local';
}

function formatConversationForSummary(messages: Array<{ role: string; content: string; timestamp: number }>): string {
  return messages.map((message) => {
    const time = new Date(message.timestamp).toLocaleString('es-MX');
    return `[${time}] ${message.role === 'user' ? 'Usuario' : 'Pulse'}: ${message.content}`;
  }).join('\n');
}

async function extractAndSaveFacts(service: any, phoneNumber: string, summaryText: string): Promise<void> {
  if (!service.apiKey) return;
  const genAI = new GoogleGenerativeAI(service.apiKey);
  const model = genAI.getGenerativeModel({
    model: SUMMARIZE_MODEL,
    generationConfig: { maxOutputTokens: 400, responseMimeType: 'application/json' },
  });
  const prompt = `Analiza este resumen de conversacion y extrae hechos CONCRETOS Y DURABLES sobre el usuario.
Solo extrae hechos que sirvan para futuras conversaciones (preferencias, contexto de trabajo, decisiones, personas clave).
NO extraigas acciones temporales ya completadas.

Categorias permitidas: ${FACT_CATEGORIES.join(', ')}

Responde SOLO con un JSON array. Si no hay hechos durables, responde [].
Ejemplo: [{"category":"preferencia","key":"formato_archivos","value":"prefiere PDF sobre DOCX"}]

RESUMEN:
${truncateToTokens(summaryText, 1500)}

JSON:`;

  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();
    const facts = JSON.parse(raw) as Array<{ category: string; key: string; value: string }>;
    if (!Array.isArray(facts)) return;
    for (const fact of facts) {
      if (!fact.category || !fact.key || !fact.value) continue;
      if (!FACT_CATEGORIES.includes(fact.category as any)) continue;
      service.saveFact({
        phoneNumber,
        category: fact.category,
        key: String(fact.key).slice(0, 80),
        value: String(fact.value).slice(0, 300),
        context: 'auto-extraido de resumen',
      });
    }
    if (facts.length > 0) console.log(`[MemoryService] Auto-facts extraidos: ${facts.length} para ${phoneNumber}`);
  } catch (err: any) {
    console.warn('[MemoryService] extractAndSaveFacts parse error:', err.message);
  }
}
