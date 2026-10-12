import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import fixture from '../../test/fixtures/audiovisual-cinematic.json';
import { filmV2Schema, type CinematicFilm } from '../shared/audiovisual/film-v2-schema';
import { FilmComposition } from '../audiovisual-runtime/composition';
import { cinematicFilm } from '../shared/audiovisual/normalize';
import { filmSchema } from '../shared/audiovisual/film-schema';
import legacyFixture from '../../test/fixtures/audiovisual-film.json';
import { frameStamp } from '../shared/audiovisual/frame-stamp';
import { actionProgress, sceneState, projectedKnowledgePortal } from '../shared/audiovisual/frame';
import { geometryFrames, visualFrames } from '../../electron/audiovisual/inspection';

describe('dirección audiovisual y datos del brief', () => {
  it('rechaza duración acortada, contraste ilegible, filas omitidas y acciones ajenas', () => {
    for (const mutate of [
      (film: CinematicFilm) => { film.fotogramas = 420; },
      (film: CinematicFilm) => { film.direccion.texto = film.direccion.fondo; },
      (film: CinematicFilm) => { film.entidades[0].filas = Array.from({ length: 5 }, (_, i) => ({ id: `fila-${i}`, titulo: 'Dato', detalle: 'Fuente', estado: 'pendiente', progreso: 0 })); },
      (film: CinematicFilm) => { film.escenas[2].acciones[0].item = 'fila-inexistente'; },
    ]) {
      const film = filmV2Schema.parse(fixture); mutate(film);
      expect(filmV2Schema.safeParse(film).success).toBe(false);
    }
  });
  it('no inventa progreso ni estados completados en aprendizaje', () => {
    const film = filmV2Schema.parse(fixture), learning = film.entidades.find(entity => entity.tipo === 'leccion')!;
    delete learning.progreso;
    learning.filas!.forEach(row => { row.estado = 'pendiente'; delete row.progreso; });
    const scene = film.escenas.find(scene => scene.elementos[0].id === learning.id)!;
    scene.acciones = [];
    const html = renderToStaticMarkup(<FilmComposition film={film} frame={scene.inicio + 180} />);
    expect(html).toContain('Sin dato');
    expect(html).not.toContain('Completado');
    expect(html).not.toContain('40%');
    for (const row of learning.filas!) expect(html).toContain(row.titulo);
  });
  it('selecciona la fila de transferencia y no activa otras con esa acción', () => {
    const film = filmV2Schema.parse(fixture), scene = film.escenas[2];
    scene.acciones = [{ en: 80, entidad: scene.elementos[0].id, accion: 'confirmacion', item: film.entidades.find(entity => entity.id === scene.elementos[0].id)!.filas![1].id }];
    const rows = film.entidades.find(entity => entity.id === scene.elementos[0].id)!.filas!;
    expect(actionProgress(sceneState(film, scene.inicio + 120), scene.elementos[0].id, 'confirmacion', film.fps, 999, .8, rows[1].id)).toBeGreaterThan(0);
    expect(actionProgress(sceneState(film, scene.inicio + 120), scene.elementos[0].id, 'confirmacion', film.fps, 999, .8, rows[0].id)).toBe(0);
  });
  it('inspecciona finales y transferencias además de los planos tempranos', () => {
    const film = filmV2Schema.parse(fixture), geometry = geometryFrames(film), visual = visualFrames(film);
    for (const scene of film.escenas) expect(geometry).toContain(scene.fin - 1);
    for (const scene of film.escenas) for (const action of scene.acciones) {
      expect(geometry).toContain(scene.inicio + action.en);
      if (action.accion === 'transferencia') expect(visual.some(frame => frame >= scene.inicio + action.en && frame < scene.fin)).toBe(true);
    }
  });
  it('respeta el progreso declarado de módulos y la confirmación tardía de una lección', () => {
    const film = filmV2Schema.parse(fixture), course = film.entidades.find(entity => entity.tipo === 'curso')!;
    const scene = film.escenas.find(scene => scene.elementos[0].id === course.id)!;
    const html = () => renderToStaticMarkup(<FilmComposition film={film} frame={scene.inicio + 240} />);
    course.filas![0].progreso = .25;
    expect(html()).toContain('aria-label="Avance declarado del módulo" aria-valuemin="0" aria-valuemax="100" aria-valuenow="25"');
    course.filas![0].progreso = .75;
    expect(html()).toContain('aria-valuenow="75"');
    const learning = film.entidades.find(entity => entity.tipo === 'leccion')!;
    const learningScene = film.escenas.find(scene => scene.elementos[0].id === learning.id)!;
    learningScene.acciones = [{ en: 299, entidad: learning.id, accion: 'confirmacion', item: learning.filas![0].id }];
    const earlier = renderToStaticMarkup(<FilmComposition film={film} frame={learningScene.inicio + 240} />);
    expect(earlier).not.toContain('Completado');
    expect(earlier).toContain('Validando');
  });
  it('alinea máscara y aro con la cámara de salida incluso en sus extremos', () => {
    const film = filmV2Schema.parse(fixture), previous = film.escenas[1];
    previous.camara = { inicio: .94, fin: 1.04, recorridoX: 18, recorridoY: 18 };
    const state = sceneState(film, previous.fin - 1), portal = projectedKnowledgePortal(state);
    expect(portal.x).toBeCloseTo(1658.8);
    expect(portal.y).toBeCloseTo(506);
    expect(portal.radius).toBeCloseTo(35.36);
    const html = renderToStaticMarkup(<FilmComposition film={film} frame={film.escenas[2].inicio} />);
    const mask = html.match(/circle\(([\d.]+)px at ([\d.]+)px ([\d.]+)px\)/)!;
    expect(mask.slice(1).map(Number)).toEqual([portal.radius, portal.x, portal.y]);
    expect(visualFrames(film)).toContain(film.escenas[2].inicio + Math.round(film.escenas[2].transicion * .5));
  });
  it('la firma de captura distingue fotogramas y reintentos y no aparece en la preview', () => {
    const signatures = new Set<string>();
    for (let frame = 0; frame < 3600; frame++) for (let nonce = 1; nonce <= 3; nonce++) signatures.add(frameStamp(frame, nonce).join(','));
    expect(signatures.size).toBe(10800);
    const film = filmV2Schema.parse(fixture);
    const preview = renderToStaticMarkup(<FilmComposition film={film} frame={84} />);
    expect(preview).not.toContain('film-frame-stamp');
    expect(preview).toContain('El');
    const capture = renderToStaticMarkup(<FilmComposition film={film} frame={84} captureNonce={1} />);
    expect(capture).toContain('top:1080px');
    expect(preview).not.toContain('top:1080px');
  });
  it('mantiene el contenido del último documento heredado sin forzarlo a un lockup', () => {
    const legacy = structuredClone(legacyFixture);
    const last = legacy.escenas[legacy.escenas.length - 1];
    const source = legacy.entidades.find(entity => entity.id === last.entidades[0].id)!;
    source.tipo = 'documento'; source.titulo = 'Revisar evidencia antes de actuar'; source.detalle = 'Detalle esencial de la fuente.';
    last.titulo = 'La decisión que sigue';
    const film = cinematicFilm(filmSchema.parse(legacy));
    const html = renderToStaticMarkup(<FilmComposition film={film} frame={film.fotogramas - 1} />);
    for (const text of [source.titulo, source.detalle]) expect(html).toContain(text);
    expect(film.escenas[film.escenas.length - 1].mensaje).toBe(last.titulo);
    for (const word of last.titulo.split(' ')) expect(html).toContain('>' + word + '</span>');
  });
});
