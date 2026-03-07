/**
 * UTILITY PROMPTS
 */

export const getImageGenerationPrompt = (userPrompt: string): string => {
  return `Genera una imagen basada en la siguiente descripción. Sigue obligatoriamente estas directrices técnicas y de seguridad:
CRITERIOS TÉCNICOS:
- Calidad profesional, alta resolución y nitidez.
- Composición visual equilibrada con buen uso del espacio.
- Iluminación natural y colores vibrantes pero realistas.
- Si no se especifica estilo, usa un estilo fotorrealista moderno y corporativo.

REGLAS ESTRICTAS DE SEGURIDAD (Obligatorio cumplimiento):
- ESTRICTAMENTE PROHIBIDO: Generar contenido visual sexualmente explícito, sugerente o NSFW.
- ESTRICTAMENTE PROHIBIDO: Mostrar desnudez parcial o total, anatomía hipersexualizada, lencería o bikinis en contextos inapropiados.
- ESTRICTAMENTE PROHIBIDO: Ropa transparente visible, siluetas desnudas bajo ropa mojada o transparente.
- Las personas generadas deben presentarse con vestimenta adecuada, modesta y respetuosa, acorde a un estándar corporativo y familiar (SFW).
- Si el prompt del usuario viola estas reglas, adapta suavemente la escena para que la imagen resultante sea completamente inofensiva, vestida y respetuosa sin emitir un mensaje de error.

Descripción original del usuario: ${userPrompt}`;
};
