import type { GoogleGenerativeAI } from '@google/generative-ai';
import type { ClipboardItem } from './types';

const NO_MATCH = 'NO_MATCH';
const EMPTY_MESSAGE = 'El portapapeles esta vacio. No hay nada guardado aun.';
const NOT_FOUND_MESSAGE = 'No se encontro informacion que coincida con la busqueda en el portapapeles.';

export async function searchClipboardItems(
  history: ClipboardItem[],
  genAI: GoogleGenerativeAI | null,
  query: string,
): Promise<string> {
  if (history.length === 0) {
    console.log(`[ClipboardAIAssistant] Busqueda "${query}" rechazada: historial vacio.`);
    return EMPTY_MESSAGE;
  }

  console.log(`[ClipboardAIAssistant] Buscando en portapapeles: "${query}"...`);
  const aiMatch = await searchWithGemini(history, genAI, query);
  if (aiMatch) return aiMatch;

  const keywordMatch = findKeywordMatch(history, query);
  if (keywordMatch) {
    logSearchResult(query, keywordMatch);
    return keywordMatch;
  }

  console.log(`[ClipboardAIAssistant] No se encontraron resultados para "${query}".`);
  return NOT_FOUND_MESSAGE;
}

async function searchWithGemini(
  history: ClipboardItem[],
  genAI: GoogleGenerativeAI | null,
  query: string,
): Promise<string | null> {
  if (!genAI) return null;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });
    const result = await model.generateContent(buildClipboardPrompt(history, query));
    const responseText = result.response.text().trim();
    if (!responseText || responseText === NO_MATCH) return null;
    logSearchResult(query, responseText);
    return responseText;
  } catch (err: any) {
    console.error('[ClipboardAIAssistant] Error en busqueda con LLM:', err.message);
    return null;
  }
}

function findKeywordMatch(history: ClipboardItem[], query: string): string | null {
  const terms = query.toLowerCase().split(/\s+/).filter((term) => term.length > 2);
  if (terms.length === 0) return null;

  const exactMatch = history.find((item) => {
    const lowerText = item.text.toLowerCase();
    return terms.every((term) => lowerText.includes(term));
  });
  if (exactMatch) return exactMatch.text;

  const partialMatch = history.find((item) => {
    const lowerText = item.text.toLowerCase();
    return terms.some((term) => term.length > 4 && lowerText.includes(term));
  });
  return partialMatch?.text ?? null;
}

function buildClipboardPrompt(history: ClipboardItem[], query: string): string {
  const historyContext = history.map((item, index) => `[ITEM ${index}]:\n${item.text}\n`).join('\n');
  return `Actua como un asistente que busca informacion en el historial del portapapeles.
El usuario esta buscando: "${query}"

A continuacion tienes el historial reciente del portapapeles (maximo 100 elementos):
${historyContext}

Tu tarea: Encuentra el item que MEJOR responda a la busqueda del usuario.
Si encuentras un item que coincide, devuelve UNICAMENTE el texto original exacto de ese item, sin agregar comillas, saludos ni explicaciones.
Si ninguno coincide razonablemente con la busqueda, responde exactamente la palabra: "${NO_MATCH}"`;
}

function logSearchResult(query: string, resultText: string): void {
  let logResult = resultText.replace(/\n/g, ' ');
  if (logResult.length > 50) logResult = `${logResult.substring(0, 50)}...`;

  if (/(password|contrase\u00f1a|token|api_key|secret|bearer|tarjeta|cvv|clave)/i.test(query) || /[A-Za-z0-9-_]{25,}/.test(resultText)) {
    logResult = '***[SENSIBLE_MASKED]***';
  }
  console.log(`[ClipboardAIAssistant] Resultado encontrado para "${query}": ${logResult}`);
}
