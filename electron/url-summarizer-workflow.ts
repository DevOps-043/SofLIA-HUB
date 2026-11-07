import { generateSessionText } from './ai-provider/text';
import {
  buildSummaryPrompt,
  extractFirstSummarizableUrl,
  fetchSummarizableHtml,
  htmlToReadableText,
  MAX_SUMMARY_CONTEXT_CHARS,
} from './url-summarizer/helpers';

export class URLSummarizerWorkflow {
  public async processMessage(text: string): Promise<string | null> {
    try {
      if (!text || typeof text !== 'string') {
        return null;
      }

      const targetUrl = extractFirstSummarizableUrl(text);
      if (!targetUrl) {
        return null;
      }

      console.log(`[URLSummarizerWorkflow] Interceptado enlace: ${targetUrl}`);

      const response = await fetchSummarizableHtml(targetUrl);
      if (!response.ok) {
        console.warn(`[URLSummarizerWorkflow] Error HTTP ${response.status} descargando ${targetUrl}`);
        return null;
      }

      const cleanText = htmlToReadableText(await response.text());
      const contextText = cleanText.slice(0, MAX_SUMMARY_CONTEXT_CHARS);

      if (contextText.length < 300) {
        console.warn('[URLSummarizerWorkflow] Contenido demasiado corto (probablemente requiere JS para renderizar).');
        return null;
      }

      const summaryText = (await generateSessionText(buildSummaryPrompt(contextText))).trim();

      return summaryText ? `\u{1F4DD} Resumen automatico:\n${summaryText}` : null;
    } catch {
      console.warn('[URLSummarizerWorkflow] No se pudo resumir el enlace.');
      return null;
    }
  }
}
