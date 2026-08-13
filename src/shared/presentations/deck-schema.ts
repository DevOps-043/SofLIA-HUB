import { z } from 'zod';

/**
 * Contrato declarativo de una presentacion. El modelo aporta contenido y
 * direccion; React conserva la geometria, Tailwind el sistema visual y Motion
 * la coreografia. No hay CSS, HTML ni coordenadas libres en esta frontera.
 */

const textoCorto = (maximo: number) => z.string().trim().min(1).max(maximo);

const movimiento = z.object({
  continuidad: z.enum(['corte', 'empuje', 'zoom', 'flujo']).default('flujo'),
  entrada: z.enum(['ascenso', 'revelado', 'foco', 'trazo']).default('ascenso'),
  enfasis: z.enum(['ninguno', 'pulso', 'conteo', 'recorrido']).default('ninguno'),
}).strict().default({ continuidad: 'flujo', entrada: 'ascenso', enfasis: 'ninguno' });

const imagen = z.object({
  src: z.string().trim().regex(/^assets\/[a-z0-9][a-z0-9._/-]*$/i, 'La imagen debe vivir bajo assets/.'),
  alt: textoCorto(180),
  ajuste: z.enum(['cubrir', 'contener']).default('cubrir'),
  posicion: z.enum(['centro', 'arriba', 'derecha', 'izquierda']).default('centro'),
}).strict();

const base = z.object({
  id: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{0,47}$/),
  antetitulo: textoCorto(48).optional(),
  titulo: textoCorto(118),
  fuente: textoCorto(140).optional(),
  movimiento,
});

const bloque = z.object({
  etiqueta: textoCorto(32).optional(),
  titulo: textoCorto(58),
  texto: textoCorto(180).optional(),
  puntos: z.array(textoCorto(90)).max(4).optional(),
}).strict();

const metrica = z.object({
  valor: textoCorto(18),
  etiqueta: textoCorto(46),
  detalle: textoCorto(90).optional(),
}).strict();

const paso = z.object({
  titulo: textoCorto(44),
  texto: textoCorto(120).optional(),
}).strict();

export const slideSchema = z.discriminatedUnion('tipo', [
  base.extend({
    tipo: z.literal('portada'),
    subtitulo: textoCorto(180).optional(),
    imagen: imagen.optional(),
  }).strict(),
  base.extend({
    tipo: z.literal('declaracion'),
    texto: textoCorto(240).optional(),
    acento: textoCorto(32).optional(),
  }).strict(),
  base.extend({
    tipo: z.literal('division'),
    texto: textoCorto(280),
    imagen,
    ladoImagen: z.enum(['izquierda', 'derecha']).default('derecha'),
  }).strict(),
  base.extend({
    tipo: z.literal('comparacion'),
    izquierda: bloque,
    derecha: bloque,
  }).strict(),
  base.extend({
    tipo: z.literal('proceso'),
    introduccion: textoCorto(150).optional(),
    pasos: z.array(paso).min(3).max(5),
  }).strict(),
  base.extend({
    tipo: z.literal('metricas'),
    introduccion: textoCorto(150).optional(),
    metricas: z.array(metrica).min(2).max(4),
  }).strict(),
  base.extend({
    tipo: z.literal('cita'),
    cita: textoCorto(260),
    autor: textoCorto(70),
    cargo: textoCorto(90).optional(),
    imagen: imagen.optional(),
  }).strict(),
  base.extend({
    tipo: z.literal('cierre'),
    texto: textoCorto(220).optional(),
    accion: textoCorto(72),
    imagen: imagen.optional(),
  }).strict(),
]);

export const presentationDeckSchema = z.object({
  version: z.literal(1),
  meta: z.object({
    titulo: textoCorto(100),
    subtitulo: textoCorto(160).optional(),
    audiencia: textoCorto(100).optional(),
    direccionVisual: textoCorto(220),
  }).strict(),
  slides: z.array(slideSchema).min(3).max(30),
}).strict().superRefine((deck, context) => {
  const ids = new Set<string>();
  deck.slides.forEach((slide, index) => {
    if (ids.has(slide.id)) {
      context.addIssue({ code: 'custom', path: ['slides', index, 'id'], message: 'El id de la diapositiva debe ser unico.' });
    }
    ids.add(slide.id);
    if (index > 0 && slide.tipo === deck.slides[index - 1]?.tipo && !['division', 'declaracion'].includes(slide.tipo)) {
      context.addIssue({ code: 'custom', path: ['slides', index, 'tipo'], message: 'No repitas el mismo arquetipo en diapositivas consecutivas.' });
    }
  });
});

export type PresentationDeck = z.infer<typeof presentationDeckSchema>;
export type PresentationSlide = z.infer<typeof slideSchema>;
export type PresentationMotion = PresentationSlide['movimiento'];

export function parsePresentationDeck(value: unknown): PresentationDeck {
  return presentationDeckSchema.parse(value);
}

export function formatDeckValidationError(error: unknown): string {
  if (!(error instanceof z.ZodError)) return error instanceof Error ? error.message : 'El deck.json no es valido.';
  return error.issues
    .slice(0, 8)
    .map((issue) => `${issue.path.join('.') || 'deck'}: ${issue.message}`)
    .join('\n');
}


