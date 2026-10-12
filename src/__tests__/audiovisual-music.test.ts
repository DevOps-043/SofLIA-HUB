import { describe, expect, it } from 'vitest';
import fixture from '../../test/fixtures/audiovisual-polish.json';
import { filmV2Schema } from '../shared/audiovisual/film-v2-schema';
import { scoreEvents } from '../shared/audiovisual/audio-score';
describe('fraseo musical y resolución de marca', () => {
  it('deja respirar el cierre, resuelve al final del plegado y conserva sincronía', () => {
    const film = filmV2Schema.parse(fixture), events = scoreEvents(film), close = film.escenas[film.escenas.length - 1];
    const start = close.inicio / film.fps, resolve = (close.inicio + close.transicion) / film.fps;
    expect(events.filter(event => ['kick','bass'].includes(event.voice) && event.at >= start)).toEqual([]);
    expect(events.some(event => event.voice === 'pad' && event.at === resolve && event.notes.includes(66))).toBe(true);
    expect(events.every(event => Number.isFinite(event.gain) && event.gain > 0 && event.at >= 0 && event.duration > 0 && event.at + event.duration <= 30 + .000001)).toBe(true);
    expect(scoreEvents(film)).toEqual(events);
    const transfer = film.escenas[3].acciones.find(action => action.accion === 'transferencia')!;
    expect(events.some(event => event.voice === 'sweep' && event.at === (film.escenas[3].inicio + transfer.en) / film.fps)).toBe(true);
  });
  it('cambia la instrumentación y deja espacio entre las frases de piano', () => {
    const film = filmV2Schema.parse(fixture), events = scoreEvents(film);
    expect(events.some(event => event.voice === 'piano')).toBe(true);
    expect(events.some(event => ['lead','pluck','hat','snare'].includes(event.voice))).toBe(false);
    expect(events.filter(event => event.voice === 'piano').every(event => event.notes.every(note => note <= 77))).toBe(true);
    const melody = events.filter(event => event.voice === 'piano' && event.notes.length === 1);
    expect(melody.some((event, i) => i > 0 && event.at - melody[i - 1].at >= 1.99)).toBe(true);
    const close = film.escenas[film.escenas.length - 1];
    expect(events.some(event => event.voice === 'piano' && event.at === (close.inicio + close.transicion) / film.fps)).toBe(true);
  });
  it('respeta los extremos de tempo y el límite corto de duración', () => {
    for (const tempo of [80,140]) {
      const film = filmV2Schema.parse(fixture); film.sonido!.tempo = tempo;
      expect(scoreEvents(film).every(event => event.at + event.duration <= 30 + .000001)).toBe(true);
    }
    const film = filmV2Schema.parse(fixture); film.fotogramas = 360; film.duracionObjetivo = 6;
    film.escenas = [{ ...film.escenas[0], inicio: 0, fin: 180, transicion: 30, acciones: [] }, { ...film.escenas[film.escenas.length - 1], inicio: 180, fin: 360, transicion: 0, acciones: [] }];
    const events = scoreEvents(filmV2Schema.parse(film));
    expect(events.every(event => event.at + event.duration <= 6 + .000001)).toBe(true);
  });
});
