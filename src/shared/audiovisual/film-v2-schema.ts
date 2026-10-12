import { z } from 'zod';
import { colorContrast } from './color';
import { emphasisWords } from './text-emphasis';

const text = (max: number) => z.string().trim().min(1).max(max);
const id = z.string().regex(/^[a-z][a-z0-9-]{0,39}$/);
const hex = z.string().regex(/^#[0-9a-f]{6}$/i);
export const filmItemSchema = z.object({ id, titulo: text(48), detalle: text(72).optional(), estado: z.enum(['pendiente', 'activo', 'completado', 'revision']).default('pendiente'), progreso: z.number().min(0).max(1).optional() }).strict();
export const filmEntitySchema = z.object({ id, titulo: text(48), detalle: text(120), etiquetas: z.array(text(24)).min(1).max(5), tipo: z.enum(['documento', 'chat', 'tablero', 'curso', 'leccion', 'ecosistema', 'marca']), filas: z.array(filmItemSchema).max(4).optional(), progreso: z.number().min(0).max(1).optional(), instruccion: text(64).optional() }).strict();
export const filmElementSchema = z.object({ id, vista: filmEntitySchema.shape.tipo.optional(), movimiento: z.enum(['quieto', 'flotar', 'recorrido', 'revelar']).default('flotar'), profundidad: z.number().min(-1).max(1).default(0), inclinacion: z.number().min(-8).max(8).default(0) }).strict();
export const filmActionSchema = z.object({ en: z.number().int().min(0), entidad: id, accion: z.enum(['entrada', 'analisis', 'confirmacion', 'transferencia', 'conexion', 'cierre']), item: id.optional() }).strict();
export const filmSceneSchema = z.object({ titulo: text(56), mensaje: text(96), subtitulo: text(120).optional(), destacados: z.array(text(48)).min(1).max(3).optional(), ladoVisual: z.enum(['izquierda','derecha']).optional(), inicio: z.number().int().min(0), fin: z.number().int().positive(), transicion: z.number().int().min(0).max(90), composicion: z.enum(['hero', 'editorial', 'duo', 'trio', 'panoramica', 'ecosistema', 'cierre']), elementos: z.array(filmElementSchema).min(1).max(3), acciones: z.array(filmActionSchema).max(12).default([]), camara: z.object({ inicio: z.number().min(.94).max(1.04).default(1), fin: z.number().min(.94).max(1.04).default(1.025), recorridoX: z.number().min(-18).max(18).default(0), recorridoY: z.number().min(-18).max(18).default(0) }).strict().default({ inicio: 1, fin: 1.025, recorridoX: 0, recorridoY: 0 }) }).strict();

export const filmV2Schema = z.object({
  version: z.literal(2), titulo: text(100), fps: z.union([z.literal(30), z.literal(60)]), ancho: z.union([z.literal(1280), z.literal(1920)]), fotogramas: z.number().int().min(180).max(3600), duracionObjetivo: z.number().int().min(6).max(60), semilla: z.number().int().min(1).max(2147483647), conceptual: z.literal(true), audio: z.enum(['sintesis', 'silencio']),
  direccion: z.object({ estilo: z.enum(['tecnologico', 'editorial', 'luminoso']), fondo: hex, superficie: hex, texto: hex, acento: hex, secundario: hex }).strict(),
  sonido: z.object({ tempo:z.number().int().min(80).max(140),intensidad:z.number().min(.1).max(1),efectos:z.number().min(0).max(1) }).strict().optional(),
  marca: z.object({ nombre: text(32), lema: text(64), logo: z.enum(['soflia', 'ninguno']).default('ninguno') }).strict(),
  entidades: z.array(filmEntitySchema).min(1).max(24), escenas: z.array(filmSceneSchema).min(2).max(12),
}).strict().superRefine((film, ctx) => {
  if (film.fotogramas !== film.duracionObjetivo * film.fps) ctx.addIssue({ code: 'custom', path: ['fotogramas'], message: 'Los fotogramas deben cumplir exactamente la duración objetivo.' });
  const entities = new Map(film.entidades.map(e => [e.id, e]));
  if (entities.size !== film.entidades.length) ctx.addIssue({ code: 'custom', message: 'Identificadores repetidos.' });
  if (film.marca.logo === 'soflia' && film.marca.nombre.toLowerCase() !== 'soflia') ctx.addIssue({ code: 'custom', path: ['marca'], message: 'El activo SofLIA solo corresponde a esa marca.' });
  if (['fondo','superficie'].some(key => colorContrast(film.direccion.texto,film.direccion[key as 'fondo'|'superficie']) < 4.5)) ctx.addIssue({ code:'custom',path:['direccion'],message:'Texto con contraste mínimo 4.5:1 sobre fondo y superficie.' });
  film.entidades.forEach((entity,i) => {
    if (entity.filas && new Set(entity.filas.map(row=>row.id)).size !== entity.filas.length) ctx.addIssue({code:'custom',path:['entidades',i,'filas'],message:'Identificadores de fila repetidos.'});
    if (entity.progreso !== undefined && entity.tipo !== 'leccion') ctx.addIssue({code:'custom',path:['entidades',i,'progreso'],message:'El progreso total pertenece a una lección; otros avances se declaran en filas.'});
    if (['ecosistema','marca'].includes(entity.tipo) && entity.filas?.length) ctx.addIssue({code:'custom',path:['entidades',i,'filas'],message:'Marca y ecosistema no presentan filas.'});
  });
  film.escenas.forEach((scene, i) => {
    const fail = (message: string) => ctx.addIssue({ code: 'custom', path: ['escenas', i], message });
    if (scene.inicio !== (film.escenas[i - 1]?.fin ?? 0) || scene.fin - scene.inicio < film.fps * 1.5 || scene.transicion > (scene.fin - scene.inicio) / 2) fail('Escenas contiguas, mínimo 1.5 s y transición inferior a media escena.');
    if (scene.destacados && (scene.composicion === 'cierre' || new Set(scene.destacados).size !== scene.destacados.length || scene.destacados.some(phrase => emphasisWords(scene.mensaje, [phrase]).size === 0) || emphasisWords(scene.mensaje, scene.destacados).size >= scene.mensaje.split(/\s+/).length)) fail('Destacados únicos, literales y sobre palabras completas; conservar parte del mensaje sin destacar.');
    if(scene.ladoVisual && scene.composicion !== 'editorial') fail('ladoVisual sólo pertenece a la composición editorial.');
    const ids = new Set(scene.elementos.map(e => e.id));
    if (ids.size !== scene.elementos.length || scene.elementos.some(e => !entities.has(e.id))) fail('Elementos repetidos o inexistentes.');
    const expected = scene.composicion === 'duo' ? 2 : scene.composicion === 'trio' ? 3 : 1;
    if (scene.elementos.length !== expected) fail(`La composición ${scene.composicion} requiere ${expected} elemento(s).`);
    if (scene.composicion === 'cierre' && (scene.elementos[0]?.vista ?? entities.get(scene.elementos[0]?.id)?.tipo) !== 'marca') fail('El cierre requiere una entidad marca.');
    const special = ['hero','panoramica','ecosistema','cierre'].includes(scene.composicion);
    if (special && scene.elementos.some(element => (element.movimiento !== 'flotar' && element.movimiento !== 'quieto') || element.profundidad !== 0 || element.inclinacion !== 0)) fail('Estas composiciones usan su movimiento interno: quieto o flotar, sin pose individual.');
    if (scene.composicion === 'ecosistema' && (scene.elementos[0].vista ?? entities.get(scene.elementos[0].id)?.tipo) !== 'ecosistema') fail('La composición ecosistema requiere esa vista.');
    if (new Set(scene.acciones.map(action => `${action.entidad}:${action.accion}:${action.item ?? ''}`)).size !== scene.acciones.length) fail('No repetir la misma acción sobre la misma entidad o fila.');
    for (const action of scene.acciones) {
      if (!ids.has(action.entidad) || action.en >= scene.fin - scene.inicio) fail('Acción fuera de la escena o entidad ausente.');
      if (action.item && !entities.get(action.entidad)?.filas?.some(row => row.id === action.item)) fail('La acción refiere a una fila inexistente.');
    }
  });
  const last = film.escenas[film.escenas.length - 1];
  if (last.fin !== film.fotogramas || last.fin - last.inicio - last.transicion < film.fps * 3 || last.composicion !== 'cierre') ctx.addIssue({ code: 'custom', message: 'La película termina con un cierre de tres segundos completos tras su transición.' });
});
export type CinematicFilm = z.infer<typeof filmV2Schema>;
export type FilmEntity = z.infer<typeof filmEntitySchema>;
export type FilmScene = z.infer<typeof filmSceneSchema>;
export type FilmItem = z.infer<typeof filmItemSchema>;
