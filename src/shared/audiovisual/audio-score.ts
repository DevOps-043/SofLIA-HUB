import type { CinematicFilm } from './film-schema';
export type ScoreVoice = 'pad' | 'bass' | 'piano' | 'kick' | 'sweep' | 'impact' | 'ui';
export type ScoreEvent = { at: number; duration: number; voice: ScoreVoice; notes: number[]; gain: number; pan: number };
/** Piano y armonías sostenidas; las escenas determinan crecimiento y resolución. */
export function scoreEvents(film: CinematicFilm): ScoreEvent[] {
  const seconds = film.fotogramas / film.fps, beat = 60 / (film.sonido?.tempo ?? 120), events: ScoreEvent[] = [];
  const close = film.escenas[film.escenas.length - 1], resolve = (close.inicio + close.transicion) / film.fps;
  const suspension = Math.max(0, close.inicio / film.fps - beat);
  const activation = film.escenas[1].inicio / film.fps;
  const sceneWith = (type: string, fallback: number) => (film.escenas.find(scene => scene.elementos.some(el => film.entidades.find(e => e.id === el.id)?.tipo === type))?.inicio ?? film.fotogramas * fallback) / film.fps;
  const development = sceneWith('chat', .27), growth = sceneWith('leccion', .64), strength = film.sonido?.intensidad ?? .8;
  const add = (voice: ScoreVoice, at: number, duration: number, notes: number[], gain: number, pan = 0) => {
    if (at >= 0 && at < seconds && duration > 0 && gain > 0) events.push({ voice, at, duration: Math.min(duration, seconds - at), notes, gain: gain * strength, pan });
  };
  const chords = [[50,57,60,65], [46,53,57,62], [53,60,64,69], [48,55,62,65]], roots = [38,34,41,36];
  const motif = [62,65,69,67,64,65,62,60];
  const harmony = (at: number) => Math.floor(at / (beat * 8)) % chords.length;
  for (let at = 0; at < suspension; at += beat * 8) {
    const index = harmony(at), end = Math.min(suspension, at + beat * 8);
    add('pad', at, end - at + .6, chords[index], at < activation ? .13 : .17);
    if (at >= development) add('bass', at, end - at, [roots[index]], .095);
    add('piano', at + .12, Math.min(beat * 5, seconds - at - .12), chords[index].slice(1), at < activation ? .075 : .1, -.15);
  }
  // Frases espaciadas, sin repetir una nota aguda en cada subdivisión.
  for (let at = .65, phrase = 0; at < suspension; at += beat * 2, phrase++) {
    if (phrase % 4 === 3) continue;
    const energy = Math.min(1, Math.max(0, (suspension - at) / (beat * 2)));
    const tone = at < activation ? 62 : at < growth ? chords[harmony(at)][1 + phrase % 3] + 12 : motif[phrase % motif.length];
    const note = tone > 74 ? tone - 12 : tone;
    add('piano', at, beat * 3.2, [note], (at < activation ? .07 : .115) * energy, Math.sin(phrase * .8) * .2);
  }
  for (let at = development; at < suspension; at += beat * 2) {
    const energy = Math.min(1, Math.max(0, (suspension - at) / (beat * 2)));
    add('kick', at, .3, [38], .055 * energy);
  }
  for (const scene of film.escenas.slice(1, -1)) {
    const at = scene.inicio / film.fps;
    add('sweep', Math.max(0, at - .4), .75, [], .012, scene.ladoVisual === 'izquierda' ? -.2 : .2);
  }
  for (const scene of film.escenas) for (const action of scene.acciones) {
    if (action.accion === 'cierre') continue;
    const at = (scene.inicio + action.en) / film.fps;
    if (action.accion === 'transferencia' || action.accion === 'conexion') add('sweep', at, .55, [], .012, Math.sin(action.en) * .18);
    else if (action.accion === 'confirmacion') add('ui', at, .4, [62,69], .009);
  }
  add('sweep', Math.max(0, resolve - .65), .65, [], .018);
  add('impact', resolve, 1.3, [38], .045);
  add('pad', resolve, seconds - resolve, [50,57,62,66], .17);
  add('piano', resolve, seconds - resolve, [62,66,69,74], .15, -.08);
  return events.sort((a, b) => a.at - b.at);
}
