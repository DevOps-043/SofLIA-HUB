import { z } from 'zod';

export const webSummarizerTool = {
  name: 'web_summarizer',
  description: 'Extrae y limpia el contenido de una página web a partir de su URL para generar un resumen ejecutivo de la misma.',
  schema: z.object({
    url: z.string().url().describe('La URL de la página web a resumir')
  }) as any,
  execute: async (args: { url: string }) => {
    try {
      const { url } = args;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3'
        }
      });
      
      if (!response.ok) {
        return `Error al acceder a la URL: HTTP ${response.status} ${response.statusText}`;
      }
      
      let html = await response.text();
      
      // Limpiar contenido HTML que no aporta al resumen usando flags 'gs' (y 'i' para case-insensitive)
      html = html.replace(/<script.*?>.*?<\/script>/gis, ' ');
      html = html.replace(/<style.*?>.*?<\/style>/gis, ' ');
      html = html.replace(/<iframe.*?>.*?<\/iframe>/gis, ' ');
      
      // Remover todas las etiquetas HTML restantes
      let text = html.replace(/<[^>]+>/g, ' ');
      
      // Decodificar entidades HTML básicas
      text = text
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&cent;/g, '¢')
        .replace(/&pound;/g, '£')
        .replace(/&yen;/g, '¥')
        .replace(/&euro;/g, '€')
        .replace(/&copy;/g, '©')
        .replace(/&reg;/g, '®')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'")
        .replace(/&#x2F;/g, '/');
      
      // Normalizar espacios y saltos de línea excesivos
      text = text.replace(/\s+/g, ' ').trim();
      
      // Truncar a los primeros 25000 caracteres para respetar los límites de tokens del modelo
      if (text.length > 25000) {
        text = text.substring(0, 25000) + '... [Contenido truncado]';
      }
      
      return `${text}\n\n[Instrucción para el Agente: Lee el contenido web anterior y genera un resumen ejecutivo con los 3 a 5 puntos más importantes para el usuario]`;
      
    } catch (error: any) {
      return `Error al intentar acceder a la URL proporcionada: ${error.message}`;
    }
  }
};
