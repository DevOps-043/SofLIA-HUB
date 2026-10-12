import type { Film, CinematicFilm } from './film-schema';

/** Compatibilidad de datos v1; no conserva un segundo motor de dibujo. */
export function cinematicFilm(film: Film): CinematicFilm {
  if (film.version === 2) return film;
  const name = film.entidades.find(e => e.tipo === 'marca')?.titulo ?? film.titulo;
  return { ...film, version: 2, duracionObjetivo: film.fotogramas / film.fps,
    direccion: { estilo: 'tecnologico', fondo: '#0A2540', superficie: '#13263B', texto: '#FFFFFF', acento: '#33CFCB', secundario: '#00D4B3' }, marca: { nombre: name, lema: film.entidades.find(e => e.tipo === 'marca')?.detalle ?? '', logo: 'ninguno' },
    entidades: film.entidades.map(e => ({ ...e, filas: e.etiquetas.map((label, i) => ({ id: `${e.id}-${i}`, titulo: label, estado: 'pendiente' as const })) })),
    escenas: film.escenas.map((scene, i) => ({ titulo: scene.titulo, mensaje: scene.titulo, inicio: scene.inicio, fin: scene.fin, transicion: scene.transicion, composicion: i === film.escenas.length - 1 && film.entidades.find(entity => entity.id === scene.entidades[0].id)?.tipo === 'marca' ? 'cierre' : scene.entidades.length === 3 ? 'trio' : scene.entidades.length === 2 ? 'duo' : i === film.escenas.length - 1 || i % 2 ? 'editorial' : 'panoramica', elementos: scene.entidades.map(e => ({ id: e.id, movimiento: 'flotar', profundidad: 0, inclinacion: 0 })), acciones: [], camara: { inicio: 1, fin: 1.02, recorridoX: 0, recorridoY: 0 } })),
  };
}
