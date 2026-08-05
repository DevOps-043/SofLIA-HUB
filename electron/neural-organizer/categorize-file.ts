import type { GoogleGenerativeAI } from '@google/generative-ai';
import { SOFLIA_RUNTIME_MODEL } from '../../src/shared/soflia-runtime-model';
import type { FileCategoryInfo } from './types';

const VALID_CATEGORIES = ['Facturas', 'Trabajo', 'Personal', 'Software', 'Otros'];

export async function categorizeFile(
  ai: GoogleGenerativeAI,
  filename: string,
  extractedText: string,
): Promise<FileCategoryInfo> {
  const model = ai.getGenerativeModel({
    model: SOFLIA_RUNTIME_MODEL,
    generationConfig: { responseMimeType: 'application/json' },
  });

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
    const result = await model.generateContent(prompt);
    const parsed = JSON.parse(result.response.text());
    const category = VALID_CATEGORIES.includes(parsed.category) ? parsed.category : 'Otros';
    return { category, summary: parsed.summary || 'Sin resumen' };
  } catch (err: any) {
    console.error('[NeuralOrganizer] LLM Categorization failed:', err.message);
    return { category: 'Otros', summary: 'Error al categorizar' };
  }
}
