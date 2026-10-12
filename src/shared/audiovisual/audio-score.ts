import type { CinematicFilm } from './film-schema';
export type ScoreVoice = 'pad'|'bass'|'pluck'|'lead'|'kick'|'snare'|'hat'|'sweep'|'impact'|'ui';
export type ScoreEvent = { at:number; duration:number; voice:ScoreVoice; notes:number[]; gain:number; pan:number };
/** Fraseo musical y efectos comparten el reloj de los planos. */
export function scoreEvents(film: CinematicFilm): ScoreEvent[] {
  const seconds = film.fotogramas / film.fps, beat = 60 / (film.sonido?.tempo ?? 120), events: ScoreEvent[] = [];
  const close = film.escenas[film.escenas.length - 1], resolve = (close.inicio + close.transicion) / film.fps;
  const suspension = Math.max(0, close.inicio / film.fps - beat);
  const activation = film.escenas[1].inicio / film.fps;
  const development = (film.escenas.find(scene => scene.elementos.some(el => film.entidades.find(e => e.id === el.id)?.tipo === 'chat'))?.inicio ?? Math.round(film.fotogramas * .27)) / film.fps;
  const growth = (film.escenas.find(scene => scene.elementos.some(el => film.entidades.find(e => e.id === el.id)?.tipo === 'leccion'))?.inicio ?? Math.round(film.fotogramas * .64)) / film.fps;
  const strength = film.sonido?.intensidad ?? .8;
  const add = (voice: ScoreVoice, at: number, duration: number, notes: number[], gain: number, pan = 0) => {
    if (at >= 0 && at < seconds && duration > 0 && gain > 0) events.push({ voice, at, duration: Math.min(duration, seconds - at), notes, gain: gain * strength, pan });
  };
  const chords = [[50,53,57,64], [46,50,53,57], [53,57,60,67], [48,52,55,62]], roots = [38,34,41,36], motif = [69,72,74,77,76,74,72,69];
  for (let at = 0; at < suspension; at += beat * 8) {
    const index = Math.floor(at / (beat * 8)) % 4;
    add('pad', at, Math.min(suspension, at + beat * 8) - at + .55, chords[index], at < activation ? .12 : .16);
  }
  for (let at = 0; at < suspension; at += beat / 2) {
    const part = Math.floor(at / (beat * 8)) % 4, n = Math.round(at / (beat / 2));
    const energy = Math.min(1, Math.max(0, (suspension - at) / (beat * 2)));
    if (at >= activation) add('pluck', at, beat * .85, [chords[part][n % 4] + 12], (.08 + Math.min(1, at / Math.max(1, growth)) * .045) * energy, Math.sin(n * .7) * .35);
    if (at >= development) {
      if (n % 2 === 0 || n % 8 === 7) add('bass', at, beat * .78, [roots[part] + (n % 8 === 7 ? 12 : 0)], (n % 2 ? .075 : .15) * energy);
      add('hat', at, .08, [], (n % 2 ? .011 : .018) * energy, n % 2 ? .32 : -.3);
    }
    // Una frase completa por compás; la segunda mitad deja respirar la melodía.
    if (at >= growth && n % 2 === 0) {
      const step = Math.round((at - growth) / beat);
      if (step % 8 < 4) add('lead', at, beat * 1.25, [motif[step % motif.length]], .043 * energy, Math.sin(step * .5) * .24);
    }
  }
  for (let at = development; at < suspension; at += beat) {
    const step = Math.round((at - development) / beat), energy = Math.min(1, Math.max(0, (suspension - at) / beat));
    if (step % 4 === 0 || step % 4 === 2) add('kick', at, .34, [38], .3 * energy);
    if (step % 2 === 1) add('snare', at, .16, [], .058 * energy, .06);
  }
  for (const scene of film.escenas.slice(1, -1)) {
    const at = scene.inicio / film.fps, portal = scene.composicion === 'editorial' && film.escenas[film.escenas.indexOf(scene) - 1]?.composicion === 'panoramica';
    add('sweep', Math.max(0, at - .4), .8, [], portal ? .07 : .038, -.25);
    if (scene.composicion === 'panoramica' || portal) add('impact', at, .9, [38], .095);
    else add('ui', at, .28, [74,81], .025, scene.ladoVisual === 'izquierda' ? -.2 : .2);
  }
  for (const scene of film.escenas) for (const action of scene.acciones) {
    if (action.accion === 'cierre') continue;
    const at = (scene.inicio + action.en) / film.fps;
    add(action.accion === 'transferencia' ? 'sweep' : 'ui', at, action.accion === 'transferencia' ? .55 : .12, [action.accion === 'confirmacion' ? 84 : 79], action.accion === 'transferencia' ? .05 : .022, Math.sin(action.en) * .24);
  }
  add('sweep', Math.max(0, resolve - .65), .65, [], .075);
  add('impact', resolve, 1.6, [38], .18);
  add('pad', resolve, seconds - resolve, [50,54,57,64], .2);
  add('lead', resolve, seconds - resolve, [74,81], .07, -.12);
  return events.sort((a, b) => a.at - b.at);
}
