import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Configuración para el Workflow de Resúmenes.
 */
export interface URLSummarizerConfig {
  apiKey: string;
  modelName?: string;
}

/**
 * Workflow proactivo que detecta URLs en mensajes, las descarga y
 * genera resúmenes automáticos usando Gemini.
 */
export class URLSummarizerWorkflow {
  private genAI: GoogleGenerativeAI;
  private modelName: string;

  constructor(config: URLSummarizerConfig) {
    if (!config.apiKey) {
      throw new Error('API Key es requerida para iniciar URLSummarizerWorkflow');
    }
    this.genAI = new GoogleGenerativeAI(config.apiKey);
    this.modelName = config.modelName || 'gemini-2.5-flash';
  }

  /**
   * Procesa un mensaje de texto para interceptar enlaces, descargar su contenido
   * y generar un resumen ejecutivo automático.
   *
   * @param text El texto del mensaje que puede contener un enlace
   * @returns El resumen formateado o null si no se encontraron enlaces o falló la extracción
   */
  public async processMessage(text: string): Promise<string | null> {
    try {
      if (!text || typeof text !== 'string') {
        return null;
      }

      // Detectar links en el chat con la expresión regular sugerida
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const matches = text.match(urlRegex);

      if (!matches || matches.length === 0) {
        return null; // No hay enlaces detectados
      }

      // Procesar solo el primer enlace para evitar múltiples llamadas en bloque
      const targetUrl = matches[0];

      // Ignorar dominios de redes sociales / video donde el HTML no tiene el texto relevante
      const skipDomains = ['youtube.com', 'youtu.be', 'instagram.com', 'facebook.com', 'tiktok.com', 'x.com', 'twitter.com', 'spotify.com'];
      if (skipDomains.some(domain => targetUrl.toLowerCase().includes(domain))) {
        return null;
      }

      console.log(`[URLSummarizerWorkflow] Interceptado enlace: ${targetUrl}`);

      // Usar API nativa fetch para descargar el contenido HTML
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8',
        },
        signal: AbortSignal.timeout(15000), // Timeout robusto de 15 segundos
      });

      if (!response.ok) {
        console.warn(`[URLSummarizerWorkflow] Error HTTP ${response.status} descargando ${targetUrl}`);
        return null;
      }

      const html = await response.text();

      // Limpiar tags usando expresiones regulares
      // Primero limpiamos scripts y estilos para que no queden como texto basura
      const htmlWithoutScripts = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
        .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
        .replace(/<header[\s\S]*?<\/header>/gi, ' ')
        .replace(/<aside[\s\S]*?<\/aside>/gi, ' ');

      // Luego removemos todos los tags HTML
      let cleanText = htmlWithoutScripts.replace(/<[^>]*>?/gm, '');
      
      // Decodificación de entidades comunes y limpieza de espacios
      cleanText = cleanText
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();

      // Recortar texto para evitar problemas con la ventana de contexto (15k chars)
      const maxChars = 15000;
      const contextText = cleanText.slice(0, maxChars);

      if (contextText.length < 300) {
        console.warn('[URLSummarizerWorkflow] Contenido demasiado corto (probablemente requiere JS para renderizar).');
        return null;
      }

      // Construir el prompt para el LLM
      const prompt = `Genera un resumen ejecutivo de 3 viñetas del siguiente artículo: [texto]\n\n${contextText}`;

      // Llamada al LLM usando la instancia configurada
      const model = this.genAI.getGenerativeModel({ model: this.modelName });
      const result = await model.generateContent(prompt);
      
      const summaryText = result.response.text().trim();
      
      if (!summaryText) {
        return null;
      }

      // Retornar la respuesta formateada solicitada
      return `📝 Resumen automático:\n${summaryText}`;

    } catch (error: any) {
      console.error(`[URLSummarizerWorkflow] Error procesando enlace: ${error.message}`);
      return null;
    }
  }
}
