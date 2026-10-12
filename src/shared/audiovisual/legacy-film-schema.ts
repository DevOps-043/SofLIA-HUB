import { z } from 'zod';

const texto = (max: number) => z.string().trim().min(1).max(max);
const id = z.string().regex(/^[a-z][a-z0-9-]{0,39}$/);
const entidad = z.object({ id, titulo: texto(38), detalle: texto(90), etiquetas: z.array(texto(20)).min(2).max(4), tipo: z.enum(['documento', 'tablero', 'leccion', 'marca']) }).strict();
const pose = z.object({ id, x: z.number().min(.03).max(.97), y: z.number().min(.25).max(.86), ancho: z.number().min(.28).max(.85), alto: z.number().min(.4).max(.56) }).strict().superRefine((p, ctx) => {
  if (p.x - p.ancho / 2 < .03 || p.x + p.ancho / 2 > .97 || p.y - p.alto / 2 < .24 || p.y + p.alto / 2 > .9) ctx.addIssue({ code: 'custom', message: 'La entidad debe permanecer dentro del área segura.' });
});
export const filmV1Schema = z.object({
  version: z.literal(1), titulo: texto(100), fps: z.union([z.literal(30), z.literal(60)]), ancho: z.union([z.literal(1280), z.literal(1920)]), fotogramas: z.number().int().min(180).max(3600), semilla: z.number().int().min(1).max(2147483647),
  conceptual: z.literal(true), audio: z.enum(['sintesis', 'silencio']),
  entidades: z.array(entidad).min(1).max(24),
  escenas: z.array(z.object({ titulo: texto(56), inicio: z.number().int().min(0), fin: z.number().int().positive(), transicion: z.number().int().min(0).max(60), entidades: z.array(pose).min(1).max(3) }).strict()).min(2).max(12),
}).strict().superRefine((film, ctx) => {
  const ids = new Set(film.entidades.map(e => e.id));
  if (ids.size !== film.entidades.length) ctx.addIssue({ code: 'custom', message: 'Los identificadores deben ser únicos.' });
  if (film.fotogramas / film.fps < 6 || film.fotogramas / film.fps > 60) ctx.addIssue({ code: 'custom', message: 'Duración admitida: 6–60 segundos.' });
  film.escenas.forEach((escena, i) => {
    if (escena.inicio !== (film.escenas[i - 1]?.fin ?? 0) || escena.fin - escena.inicio < film.fps * 1.5 || escena.transicion > (escena.fin - escena.inicio) / 2) ctx.addIssue({ code: 'custom', path: ['escenas', i], message: 'Las escenas deben ser contiguas y durar al menos 1.5 segundos.' });
    const vistos = new Set<string>();
    for (const p of escena.entidades) { if (!ids.has(p.id) || vistos.has(p.id)) ctx.addIssue({ code: 'custom', path: ['escenas', i], message: 'Referencia de entidad inexistente o repetida.' }); vistos.add(p.id); }
  });
  const ultima = film.escenas[film.escenas.length - 1]!;
  if (ultima.fin !== film.fotogramas || ultima.fin - ultima.inicio - ultima.transicion < film.fps * 3) ctx.addIssue({ code: 'custom', message: 'El cierre debe durar tres segundos completos tras la transición y terminar en el último fotograma.' });
});
export type FilmV1 = z.infer<typeof filmV1Schema>;
