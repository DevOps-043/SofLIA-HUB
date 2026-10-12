import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type { CinematicFilm } from '../shared/audiovisual/film-schema';
import { FilmComposition } from './composition';
import { renderAudio } from './audio';
declare global {
  interface Window { __FILM__: CinematicFilm; __FILM_CAPTURE__?: boolean; __filmDraw: (frame: number, nonce?:number) => Promise<void>; __filmReady: Promise<void>; __filmAudio: () => ReturnType<typeof renderAudio>; }
}
const root = createRoot(document.getElementById('root')!);
const film = window.__FILM__;
window.__filmAudio = () => renderAudio(film);
const resize = () => { const scale = Math.min(innerWidth / 1920, innerHeight / 1080); const element=document.getElementById('root')!; element.style.transform=window.__FILM_CAPTURE__?`scale(${scale})`:`translate(-50%,-50%) scale(${scale})`;if(window.__FILM_CAPTURE__){element.style.left='0';element.style.top='0';} };
resize(); window.addEventListener('resize', resize);
window.__filmDraw = async (frame,nonce=0) => {
  flushSync(() => root.render(<FilmComposition film={film} frame={frame} captureNonce={window.__FILM_CAPTURE__?nonce:undefined} />));
  // Fuerza layout antes de pedir al compositor una captura del fotograma actual.
  document.getElementById('root')!.getBoundingClientRect();
};
window.__filmReady = window.__filmDraw(0).then(async () => {
  const loaded = await Promise.all([document.fonts.load('400 24px "Film Inter"'), document.fonts.load('600 24px "Film Inter"'), document.fonts.load('400 18px "Film Mono"')]);
  if (loaded.some(faces => !faces.length)) throw new Error('Faltan fuentes del runtime audiovisual.');
  await document.fonts.ready;
});
if (!window.__FILM_CAPTURE__) {
  const start = performance.now(); let previous = -1;
  const tick = (now: number) => { const frame = Math.min(film.fotogramas - 1, Math.floor((now - start) / 1000 * film.fps)); if (frame !== previous) { void window.__filmDraw(frame); previous = frame; } if (frame < film.fotogramas - 1) requestAnimationFrame(tick); };
  void window.__filmReady.then(() => requestAnimationFrame(tick));
}
