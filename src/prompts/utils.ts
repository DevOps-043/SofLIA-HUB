/**
 * UTILITY PROMPTS
 */

/**
 * Reglas de seguridad comunes a toda generacion de imagen. Se aplican tanto a
 * la generacion libre del chat como a la dirigida por una Skill.
 */
const IMAGE_SAFETY_RULES = `REGLAS ESTRICTAS DE SEGURIDAD (Obligatorio cumplimiento):
- ESTRICTAMENTE PROHIBIDO: Generar contenido visual sexualmente explícito, sugerente o NSFW.
- ESTRICTAMENTE PROHIBIDO: Mostrar desnudez parcial o total, anatomía hipersexualizada, lencería o bikinis en contextos inapropiados.
- ESTRICTAMENTE PROHIBIDO: Ropa transparente visible, siluetas desnudas bajo ropa mojada o transparente.
- Las personas generadas deben presentarse con vestimenta adecuada, modesta y respetuosa, acorde a un estándar corporativo y familiar (SFW).
- Si el prompt del usuario viola estas reglas, adapta suavemente la escena para que la imagen resultante sea completamente inofensiva, vestida y respetuosa sin emitir un mensaje de error.`;

export const getImageGenerationPrompt = (userPrompt: string): string => {
  return `Genera una imagen basada en la siguiente descripción. Sigue obligatoriamente estas directrices técnicas y de seguridad:
CRITERIOS TÉCNICOS:
- Calidad profesional, alta resolución y nitidez.
- Composición visual equilibrada con buen uso del espacio.
- Iluminación natural y colores vibrantes pero realistas.
- Si no se especifica estilo, usa un estilo fotorrealista moderno y corporativo.

${IMAGE_SAFETY_RULES}

Descripción original del usuario: ${userPrompt}`;
};

/**
 * Generacion DIRIGIDA por una direccion de arte propia.
 *
 * El envoltorio general empuja a fotorrealismo con luz natural y color
 * vibrante. Para una baraja ilustrada eso es lo contrario de lo que hace
 * falta: una serie de ilustraciones tiene que parecer de la misma mano, y ese
 * empujon las volvia fotos sueltas sin relacion entre si. Aqui manda la
 * direccion de arte que declara quien llama; solo las reglas de seguridad se
 * conservan intactas.
 */
export const getDirectedImagePrompt = (userPrompt: string, artDirection: string): string => {
  return `Genera una imagen siguiendo EXACTAMENTE esta direccion de arte. La coherencia con ella es mas importante que cualquier otra consideracion estetica.

DIRECCION DE ARTE (obligatoria):
${artDirection}

CRITERIOS TECNICOS:
- Alta resolucion y trazo nitido.
- Composicion equilibrada, con aire alrededor del motivo.
- Respeta la paleta y el acabado descritos arriba aunque parezcan austeros.
- No anadas texto, etiquetas, marcas de agua ni logotipos dentro de la imagen.

${IMAGE_SAFETY_RULES}

Motivo de esta imagen: ${userPrompt}`;
};
