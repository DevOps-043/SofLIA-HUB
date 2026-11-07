import { getSessionOpenAIClient } from '../ai-provider/session-client';
import { SOFLIA_DEFAULT_MODEL } from '../../src/shared/soflia-runtime-model';

export async function webSearch(query: string): Promise<{ success: boolean; results?: string; error?: string }> {
  if (typeof query !== 'string' || !query.trim() || query.length > 8000) return { success: false, error: 'Consulta no válida.' };
  try {
    const client = await getSessionOpenAIClient();
    const response = await client.responses.create({
      model: SOFLIA_DEFAULT_MODEL, input: query, tools: [{ type: 'web_search' }], store: false,
      reasoning: { effort: 'low' }, max_output_tokens: 4096,
    }, { signal: AbortSignal.timeout(45_000) });
    const sources = new Map<string, string>();
    for (const item of response.output) {
      if (item.type !== 'message') continue;
      for (const part of item.content) {
        if (part.type !== 'output_text') continue;
        for (const citation of part.annotations) {
          if (citation.type === 'url_citation' && /^https?:\/\//i.test(citation.url)) sources.set(citation.url, citation.title);
        }
      }
    }
    const list = [...sources].slice(0, 8).map(([url, title]) => `- ${title || url}: ${url}`).join('\n');
    if (!response.output_text.trim()) return { success: false, error: 'La búsqueda no devolvió resultados.' };
    return { success: true, results: response.output_text.slice(0, 4500) + (list ? `\n\nFuentes:\n${list.slice(0, 1500)}` : '') };
  } catch {
    return { success: false, error: 'No se pudo completar la búsqueda web.' };
  }
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
