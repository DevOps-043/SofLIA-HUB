import type { GoogleGenerativeAI } from '@google/generative-ai';
import { sanitizeSearchLogText } from './sensitive';
import type { ClipboardItem } from './types';

export async function searchClipboardHistory(
  query: string,
  history: ClipboardItem[],
  genAI: GoogleGenerativeAI | null,
): Promise<string> {
  if (history.length === 0) {
    console.log(`[ClipboardAIAssistant] Busqueda "${query}" rechazada: historial vacio.`);
    return 'El portapapeles esta vacio. No hay nada guardado aun.';
  }

  console.log(`[ClipboardAIAssistant] Buscando en portapapeles: "${query}"...`);
  const aiMatch = genAI ? await searchWithAi(query, history, genAI) : null;
  if (aiMatch) return aiMatch;

  const keywordMatch = searchByKeywords(query, history);
  if (keywordMatch) return keywordMatch;

  console.log(`[ClipboardAIAssistant] No se encontraron resultados para "${query}".`);
  return 'No se encontro informacion que coincida con la busqueda en el portapapeles.';
}

async function searchWithAi(
  query: string,
  history: ClipboardItem[],
  genAI: GoogleGenerativeAI,
): Promise<string | null> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });
    const historyContext = history.map((item, index) => `[ITEM ${index}]:\n${item.text}\n`).join('\n');
    const prompt = `Actua como un asistente que busca informacion en el historial del portapapeles.
El usuario esta buscando: "${query}"

Historial reciente:
${historyContext}

Devuelve UNICAMENTE el texto original exacto del item que mejor coincide, o "NO_MATCH".`;
    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();
    if (responseText && responseText !== 'NO_MATCH') {
      logSearchResult(query, responseText);
      return responseText;
    }
  } catch (err: any) {
    console.error('[ClipboardAIAssistant] Error en busqueda con LLM:', err.message);
  }
  return null;
}

function searchByKeywords(query: string, history: ClipboardItem[]): string | null {
  const terms = query.toLowerCase().split(/\s+/).filter((term) => term.length > 2);
  if (terms.length === 0) return null;

  const fullMatch = history.find((item) =>
    terms.every((term) => item.text.toLowerCase().includes(term)),
  );
  if (fullMatch) {
    logSearchResult(query, fullMatch.text);
    return fullMatch.text;
  }

  const partialMatch = history.find((item) =>
    terms.some((term) => term.length > 4 && item.text.toLowerCase().includes(term)),
  );
  if (!partialMatch) return null;
  logSearchResult(query, partialMatch.text);
  return partialMatch.text;
}

function logSearchResult(query: string, resultText: string): void {
  console.log(`[ClipboardAIAssistant] Resultado encontrado para "${query}": ${sanitizeSearchLogText(query, resultText)}`);
}
