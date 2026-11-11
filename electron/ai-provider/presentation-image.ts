import { OPENAI_IMAGE_MODEL } from '../../src/shared/image-generation';
import { projectImageResponse } from '../image-generation/response';
import { getSessionOpenAIClient } from './session-client';

/** Recurso visual de diapositiva, con la misma credencial nativa del resto de IA. */
export async function generatePresentationImage(prompt: string, diagram = false): Promise<string | null> {
  try {
    const client = await getSessionOpenAIClient();
    const response = await client.images.generate({
      model: OPENAI_IMAGE_MODEL, n: 1, output_format: 'png',
      prompt: `Genera ${diagram ? 'un diagrama infográfico limpio de estilo vectorial' : 'una fotografía o ilustración profesional'} para una presentación. Composición moderna y limpia, sin texto ni marcas de agua, formato panorámico 16:9. Tema: ${prompt}`,
    }, { signal: AbortSignal.timeout(120_000) });
    const result = projectImageResponse(response);
    return result.success ? result.imageData ?? null : null;
  } catch {
    console.warn('[Presentaciones] No se pudo generar el recurso visual.');
    return null;
  }
}
