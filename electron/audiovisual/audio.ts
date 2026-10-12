import type { Film } from '../../src/shared/audiovisual/film-schema';
import { cinematicFilm } from '../../src/shared/audiovisual/normalize';
import { scoreEvents } from '../../src/shared/audiovisual/audio-score';
/** Trazabilidad del mismo plan que sintetiza Chromium; no existe otro motor de música. */
export const audioCues = (film:Film) => scoreEvents(cinematicFilm(film)).map(event=>({frame:Math.round(event.at*film.fps),tipo:event.voice}));
