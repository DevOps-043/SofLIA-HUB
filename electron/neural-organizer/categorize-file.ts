import { generateSessionText } from '../ai-provider/text';
import type { FileCategoryInfo } from './types';

const VALID_CATEGORIES = ['Facturas', 'Trabajo', 'Personal', 'Software', 'Otros'];

export async function categorizeFile(
  filename: string,
  extractedText: string,
  signal: AbortSignal,
): Promise<FileCategoryInfo> {
  const prompt = `
Analiza el siguiente archivo para categorizarlo.
Nombre del archivo: "${filename}"
${extractedText ? `Texto extraido (OCR): "${extractedText.substring(0, 1500)}"` : ''}

Devuelve un JSON estricto con la siguiente estructura:
{
  "category": "Una de: Facturas|Trabajo|Personal|Software|Otros",
  "summary": "Un resumen muy corto (max 15 palabras) de que trata el archivo basado en el nombre y texto."
}
`;

  try {
    const result = await generateSessionText(prompt, { json: true, signal });
    const parsed = JSON.parse(result);
    const category = VALID_CATEGORIES.includes(parsed.category) ? parsed.category : 'Otros';
    return { category, summary: parsed.summary || 'Sin resumen' };
  } catch {
    signal.throwIfAborted();
    console.warn('[NeuralOrganizer] No se pudo categorizar el archivo.');
    return { category: 'Otros', summary: 'Error al categorizar' };
  }
}
