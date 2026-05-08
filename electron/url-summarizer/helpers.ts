const SKIP_DOMAINS = [
  'youtube.com',
  'youtu.be',
  'instagram.com',
  'facebook.com',
  'tiktok.com',
  'x.com',
  'twitter.com',
  'spotify.com',
];

export const MAX_SUMMARY_CONTEXT_CHARS = 15000;

export function extractFirstSummarizableUrl(text: string): string | null {
  const matches = text.match(/(https?:\/\/[^\s]+)/g);
  if (!matches || matches.length === 0) {
    return null;
  }

  const targetUrl = matches[0];
  const normalizedUrl = targetUrl.toLowerCase();
  return SKIP_DOMAINS.some((domain) => normalizedUrl.includes(domain)) ? null : targetUrl;
}

export async function fetchSummarizableHtml(targetUrl: string): Promise<Response> {
  return fetch(targetUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8',
    },
    signal: AbortSignal.timeout(15000),
  });
}

export function htmlToReadableText(html: string): string {
  const htmlWithoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<aside[\s\S]*?<\/aside>/gi, ' ');

  return htmlWithoutScripts
    .replace(/<[^>]*>?/gm, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildSummaryPrompt(contextText: string): string {
  return `Genera un resumen ejecutivo de 3 vinetas del siguiente articulo: [texto]\n\n${contextText}`;
}
