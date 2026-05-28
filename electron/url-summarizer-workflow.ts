import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  buildSummaryPrompt,
  extractFirstSummarizableUrl,
  fetchSummarizableHtml,
  htmlToReadableText,
  MAX_SUMMARY_CONTEXT_CHARS,
} from './url-summarizer/helpers';

export interface URLSummarizerConfig {
  apiKey: string;
  modelName?: string;
}

export class URLSummarizerWorkflow {
  private genAI: GoogleGenerativeAI;
  private modelName: string;

  constructor(config: URLSummarizerConfig) {
    if (!config.apiKey) {
      throw new Error('API Key es requerida para iniciar URLSummarizerWorkflow');
    }
    this.genAI = new GoogleGenerativeAI(config.apiKey);
    this.modelName = config.modelName || 'gemini-3.1-flash-lite';
  }

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

      const model = this.genAI.getGenerativeModel({ model: this.modelName });
      const result = await model.generateContent(buildSummaryPrompt(contextText));
      const summaryText = result.response.text().trim();

      return summaryText ? `\u{1F4DD} Resumen automatico:\n${summaryText}` : null;
    } catch (error: any) {
      console.error(`[URLSummarizerWorkflow] Error procesando enlace: ${error.message}`);
      return null;
    }
  }
}
