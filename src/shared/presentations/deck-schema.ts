import { z } from 'zod';

/**
 * Contrato declarativo de una presentacion. El modelo aporta contenido y
 * direccion; React conserva la geometria, Tailwind el sistema visual y Motion
 * la coreografia. No hay CSS, HTML ni coordenadas libres en esta frontera.
 */

const textoCorto = (maximo: number) => z.string().trim().min(1).max(maximo);
const colorHex = z.string().trim().regex(/^#[0-9a-f]{6}$/i, 'Usa un color hexadecimal de seis digitos.');

const temaFuente = z.object({
  origen: z.enum(['fuente', 'usuario']),
  fondo: colorHex,
  texto: colorHex,
  primario: colorHex,
  secundario: colorHex,
  acento: colorHex,
  superficie: colorHex,
}).strict().superRefine((tema, context) => {
  const comprobaciones = [
    ['texto', tema.texto, tema.fondo, 4.5, 'El texto y el fondo deben tener contraste accesible.'],
    ['superficie', tema.texto, tema.superficie, 4.5, 'El texto y la superficie deben tener contraste accesible.'],
    ['primario', tema.primario, tema.fondo, 3, 'El color primario debe distinguirse del fondo.'],
    ['acento', tema.acento, tema.fondo, 3, 'El acento debe distinguirse del fondo.'],
  ] as const;
  comprobaciones.forEach(([campo, frente, fondo, minimo, mensaje]) => {
    if (contrastRatio(frente, fondo) < minimo) {
      context.addIssue({ code: 'custom', path: [campo], message: mensaje });
    }
  });
});

const temaPresentacion = z.union([
  z.object({ origen: z.literal('organizacion') }).strict(),
  temaFuente,
]);

const fuenteMeta = z.object({
  nombre: textoCorto(120),
  url: z.string().url().max(500).optional(),
  observada: textoCorto(80).optional(),
}).strict();

const movimiento = z.object({
  continuidad: z.preprocess(
    (value) => value === 'foco' ? 'zoom' : value,
    z.enum(['corte', 'empuje', 'zoom', 'flujo']).default('flujo'),
  ),
  entrada: z.enum(['ascenso', 'revelado', 'foco', 'trazo']).default('ascenso'),
  enfasis: z.enum(['ninguno', 'pulso', 'conteo', 'recorrido']).default('ninguno'),
}).strict().default({ continuidad: 'flujo', entrada: 'ascenso', enfasis: 'ninguno' });

const imagen = z.object({
  src: z.string().trim().regex(/^assets\/[a-z0-9][a-z0-9._/-]*$/i, 'La imagen debe vivir bajo assets/.'),
  alt: textoCorto(180),
  ajuste: z.enum(['cubrir', 'contener']).default('cubrir'),
  posicion: z.enum(['centro', 'arriba', 'derecha', 'izquierda']).default('centro'),
}).strict();

const imagenOpcional = imagen.optional();

const base = z.object({
  id: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{0,47}$/),
  antetitulo: textoCorto(48).optional(),
  titulo: textoCorto(118),
  fuente: textoCorto(140).optional(),
  variante: z.enum(['editorial', 'visual-dominante', 'compacta', 'inmersiva', 'secuencial']).optional(),
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
  nota: textoCorto(90).optional(),
}).strict();

const paso = z.object({
  numero: textoCorto(8).optional(),
  titulo: textoCorto(44),
  texto: textoCorto(120).optional(),
}).strict();

const filaComparacion = z.object({
  proyecto: textoCorto(70),
  enfoque: textoCorto(140),
}).strict();

const citaMultiple = z.object({
  texto: textoCorto(220),
  atribucion: textoCorto(120),
}).strict();

const serieGrafica = z.object({
  nombre: textoCorto(42),
  valores: z.array(z.number().finite()).min(2).max(8),
}).strict();

export const slideSchema = z.union([
  base.extend({ tipo: z.literal('tabla'), columnas: z.array(textoCorto(32)).min(2).max(5), filas: z.array(z.array(textoCorto(80)).min(2).max(5)).min(1).max(6) }).strict().superRefine((slide, ctx) => {
    if (slide.filas.some(f => f.length !== slide.columnas.length)) ctx.addIssue({ code: 'custom', message: 'Cada fila requiere una celda por columna.' });
    const width = 1600 / slide.columnas.length;
    const height = slide.filas.reduce((sum, f) => sum + Math.max(...f.map(c => Math.ceil(c.length * 14 / (width - 40)))) * 30 + 24, 70);
    if (height > 540) ctx.addIssue({ code: 'custom', message: 'La tabla es demasiado densa; divídela en más diapositivas.' });
  }),
  base.extend({ tipo: z.literal('diagrama'), nodos: z.array(z.object({ id: textoCorto(40), titulo: textoCorto(44), texto: textoCorto(100).optional() }).strict()).min(2).max(6), conexiones: z.array(z.object({ desde: textoCorto(40), hasta: textoCorto(40) }).strict()).min(1).max(8) }).strict().superRefine((slide, ctx) => {
    const ids = new Set(slide.nodos.map(n => n.id));
    if (ids.size !== slide.nodos.length || slide.conexiones.some(c => c.desde === c.hasta || !ids.has(c.desde) || !ids.has(c.hasta))) ctx.addIssue({ code: 'custom', message: 'El diagrama requiere identificadores únicos y conexiones existentes.' });
  }),
  base.extend({
    tipo: z.literal('portada'),
    subtitulo: textoCorto(180).optional(),
    texto: textoCorto(220).optional(),
    imagen: imagenOpcional,
  }).strict(),
  base.extend({
    tipo: z.literal('declaracion'),
    texto: textoCorto(240).optional(),
    puntos: z.array(textoCorto(100)).max(4).optional(),
    imagen: imagenOpcional,
    acento: textoCorto(32).optional(),
  }).strict(),
  z.union([
    base.extend({
      tipo: z.literal('division'),
      texto: textoCorto(280),
      imagen,
      bloques: z.never().optional(),
      ladoImagen: z.enum(['izquierda', 'derecha']).default('derecha'),
    }).strict(),
    base.extend({
      tipo: z.literal('division'),
      texto: textoCorto(280),
      bloques: z.array(bloque).min(2).max(4),
      imagen: z.never().optional(),
      ladoImagen: z.never().optional(),
    }).strict(),
  ]),
  z.union([
    base.extend({
      tipo: z.literal('comparacion'),
      texto: textoCorto(220).optional(),
      izquierda: bloque,
      derecha: bloque,
      filas: z.never().optional(),
      imagen: imagenOpcional,
      pie: textoCorto(140).optional(),
    }).strict(),
    base.extend({
      tipo: z.literal('comparacion'),
      texto: textoCorto(220).optional(),
      filas: z.array(filaComparacion).min(2).max(4),
      izquierda: z.never().optional(),
      derecha: z.never().optional(),
      imagen: imagenOpcional,
      pie: textoCorto(140).optional(),
    }).strict(),
  ]),
  base.extend({
    tipo: z.literal('proceso'),
    introduccion: textoCorto(150).optional(),
    texto: textoCorto(240).optional(),
    pasos: z.array(paso).min(3).max(5),
    imagen: imagenOpcional,
  }).strict(),
  base.extend({
    tipo: z.literal('metricas'),
    introduccion: textoCorto(150).optional(),
    texto: textoCorto(240).optional(),
    metricas: z.array(metrica).min(2).max(4),
    imagen: imagenOpcional,
  }).strict(),
  base.extend({
    tipo: z.literal('grafica'),
    introduccion: textoCorto(180).optional(),
    tipoGrafica: z.enum(['barras', 'lineas', 'area', 'radar', 'anillo']),
    categorias: z.array(textoCorto(32)).min(2).max(8),
    series: z.array(serieGrafica).min(1).max(3),
    unidad: textoCorto(24).optional(),
    nota: textoCorto(180).optional(),
    imagen: imagenOpcional,
  }).strict(),
  z.union([
    base.extend({
      tipo: z.literal('cita'),
      cita: textoCorto(260),
      autor: textoCorto(70),
      cargo: textoCorto(90).optional(),
      citas: z.never().optional(),
      imagen: imagenOpcional,
    }).strict(),
    base.extend({
      tipo: z.literal('cita'),
      citas: z.array(citaMultiple).min(2).max(3),
      cita: z.never().optional(),
      autor: z.never().optional(),
      cargo: z.never().optional(),
      imagen: imagenOpcional,
    }).strict(),
  ]),
  base.extend({
    tipo: z.literal('cierre'),
    texto: textoCorto(220).optional(),
    puntos: z.array(textoCorto(100)).max(4).optional(),
    accion: textoCorto(72),
    imagen: imagenOpcional,
  }).strict(),
]).superRefine((slide, context) => {
  if (slide.tipo !== 'grafica') return;
  slide.series.forEach((serie, index) => {
    if (serie.valores.length !== slide.categorias.length) {
      context.addIssue({
        code: 'custom',
        path: ['series', index, 'valores'],
        message: 'Cada serie debe tener un valor por categoria.',
      });
    }
  });
  if (slide.tipoGrafica === 'anillo' && slide.series.length !== 1) {
    context.addIssue({
      code: 'custom',
      path: ['series'],
      message: 'La grafica de anillo admite una sola serie.',
    });
  }
});

export const presentationDeckSchema = z.object({
  version: z.literal(1),
  meta: z.object({
    titulo: textoCorto(100),
    subtitulo: textoCorto(160).optional(),
    audiencia: textoCorto(100).optional(),
    direccionVisual: textoCorto(220),
    tema: temaPresentacion.optional(),
    fuentes: z.array(fuenteMeta).max(12).optional(),
    notaFuente: textoCorto(500).optional(),
  }).strict(),
  slides: z.array(slideSchema).min(3).max(30),
}).strict().superRefine((deck, context) => {
  const ids = new Set<string>();
  const firmasVisuales = new Map<string, number>();
  deck.slides.forEach((slide, index) => {
    if (ids.has(slide.id)) {
      context.addIssue({ code: 'custom', path: ['slides', index, 'id'], message: 'El id de la diapositiva debe ser unico.' });
    }
    ids.add(slide.id);
    if (slide.variante) {
      const firma = `${slide.tipo}:${slide.variante}`;
      const anterior = firmasVisuales.get(firma);
      if (anterior !== undefined && deck.slides.every((item) => item.variante)) {
        context.addIssue({
          code: 'custom',
          path: ['slides', index, 'variante'],
          message: `La firma visual ${firma} ya se uso en la diapositiva ${anterior + 1}; elige otra variante o arquetipo.`,
        });
      } else {
        firmasVisuales.set(firma, index);
      }
    }
    if (index > 0 && slide.tipo === deck.slides[index - 1]?.tipo && !['division', 'declaracion'].includes(slide.tipo)) {
      context.addIssue({ code: 'custom', path: ['slides', index, 'tipo'], message: 'No repitas el mismo arquetipo en diapositivas consecutivas.' });
    }
  });
  if (deck.slides.length >= 8 && deck.slides.every((slide) => slide.variante)) {
    const variantes = new Set(deck.slides.map((slide) => slide.variante));
    if (variantes.size < 4) {
      context.addIssue({
        code: 'custom',
        path: ['slides'],
        message: 'Una baraja de ocho o mas diapositivas debe combinar al menos cuatro variantes compositivas.',
      });
    }
  }
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

function contrastRatio(a: string, b: string): number {
  const [claro, oscuro] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
}

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const [r, g, b] = channels.map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
}
