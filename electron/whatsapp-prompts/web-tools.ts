import { GoogleGenerativeAI } from '@google/generative-ai';

const SEARCH_MODEL = 'gemini-3.5-flash';

function getApiKey(): string | null {
  return process.env.VITE_GEMINI_API_KEY || null;
}

export async function webSearch(query: string): Promise<{ success: boolean; results?: string; error?: string }> {
  const apiKey = getApiKey();
  if (apiKey) {
    try {
      return await searchWithGeminiGrounding(query, apiKey);
    } catch {
      // fallback a scraping HTML si falla grounding
    }
  }
  return searchWithHtmlFallback(query);
}

async function searchWithGeminiGrounding(query: string, apiKey: string): Promise<{ success: boolean; results?: string; error?: string }> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: SEARCH_MODEL,
    tools: [{ googleSearchRetrieval: {} }],
  });

  const result = await model.generateContent(query);
  const response = result.response;
  const text = response.text();

  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const urls = chunks
    .filter((c) => c.web?.uri)
    .map((c) => `- ${c.web!.title || c.web!.uri}: ${c.web!.uri}`)
    .join('\n');

  const full = urls ? `${text}\n\nFuentes:\n${urls}` : text;
  return { success: true, results: full.slice(0, 6000) };
}

export async function readWebpage(url: string): Promise<{ success: boolean; content?: string; error?: string }> {
  try {
    const resp = await fetch(url, {
      headers: {
        ...browserHeaders(),
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(20000),
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
    return { success: true, content: htmlToText(await resp.text(), true).slice(0, 8000) };
  } catch (err: any) {
    return { success: false, error: `Error leyendo la pagina: ${err.message}` };
  }
}

async function searchWithHtmlFallback(query: string): Promise<{ success: boolean; results?: string; error?: string }> {
  try {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const resp = await fetch(searchUrl, { headers: browserHeaders() });
    if (!resp.ok) return searchWithGoogleFallback(query);
    return { success: true, results: htmlToText(await resp.text()).slice(0, 6000) };
  } catch (err: any) {
    return { success: false, error: `Error buscando en la web: ${err.message}` };
  }
}

async function searchWithGoogleFallback(query: string) {
  const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=8&hl=es`;
  const response = await fetch(googleUrl, { headers: browserHeaders() });
  return { success: true, results: htmlToText(await response.text()).slice(0, 5000) };
}

function browserHeaders() {
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };
}

function htmlToText(html: string, removeLayout = false): string {
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');

  if (removeLayout) {
    text = text
      .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
      .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
      .replace(/<header[\s\S]*?<\/header>/gi, ' ')
      .replace(/<aside[\s\S]*?<\/aside>/gi, ' ')
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ');
  }

  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
