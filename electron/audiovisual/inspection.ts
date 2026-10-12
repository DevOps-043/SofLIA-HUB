

import sharp from 'sharp';
import type { Film } from '../../src/shared/audiovisual/film-schema';
import { createFilmRenderer } from './browser-renderer';
import { cinematicFilm } from '../../src/shared/audiovisual/normalize';

export const visualFrames = (film: Film) => cinematicFilm(film).escenas.flatMap((scene, index, scenes) => {
  const transfer = scene.acciones.find(action=>action.accion==='transferencia');
  const portal = scenes[index-1]?.composicion === 'panoramica' && scene.composicion === 'editorial' && scene.transicion > 0;
  return [...(portal ? [scene.inicio + Math.round(scene.transicion*.5)] : []), Math.round(scene.inicio+(scene.fin-scene.inicio)*.35), transfer ? Math.min(scene.fin-1,scene.inicio+transfer.en+Math.round(film.fps*.5)) : scene.fin-1];
});
export const geometryFrames = (film: Film) => [...new Set([...cinematicFilm(film).escenas.flatMap(scene=>[
  scene.inicio, scene.inicio+scene.transicion, Math.min(scene.fin-1,scene.inicio+scene.transicion+film.fps), scene.fin-1,
  ...scene.acciones.flatMap(action=>[scene.inicio+action.en,Math.min(film.fotogramas-1,scene.inicio+action.en+Math.round(film.fps*.5))]),
]),...visualFrames(film)])].filter(frame=>frame>=0&&frame<film.fotogramas).sort((a,b)=>a-b);
/** Dos momentos por escena: verifica evolución además de la composición central. */
export async function inspectFilm(film: Film, root: string, directory: string, signal: AbortSignal, guard: () => Promise<void>) {
  const renderer = await createFilmRenderer(film, root, directory, signal), frames = visualFrames(film);
  const tiles: Buffer[] = [], issues: Array<{ frame: number; textos: string[] }> = [];
  try {
    const measured = geometryFrames(film);
    for(const frame of measured) { await guard(); const textos=await renderer.checkLayout(frame); if(textos.length) issues.push({frame,textos}); }
    for (const frame of frames) {
      await guard();
      const image = await renderer.capture(frame);
      const label = Buffer.from(`<svg width="480" height="28"><rect width="480" height="28" fill="#081520"/><text x="12" y="19" fill="#b8d8dc" font-family="sans-serif" font-size="13">Fotograma ${frame} · ${(frame / film.fps).toFixed(2)} s</text></svg>`);
      tiles.push(await sharp({ create: { width: 480, height: 298, channels: 3, background: '#081520' } }).composite([{ input: await sharp(image).resize(480,270).toBuffer(), top: 28, left: 0 }, { input: label, top: 0, left: 0 }]).png().toBuffer());
    }
    const sheets: string[] = [];
    const perSheet = Math.max(12, Math.ceil(tiles.length / 2));
    for (let offset = 0; offset < tiles.length; offset += perSheet) {
      const group = tiles.slice(offset, offset + perSheet), rows = Math.ceil(group.length / 4);
      const sheet = await sharp({ create: { width: 1920, height: rows * 298, channels: 3, background: '#081520' } }).composite(group.map((input,i) => ({ input, left: i % 4 * 480, top: Math.floor(i / 4) * 298 }))).jpeg({ quality: 88 }).toBuffer();
      sheets.push('data:image/jpeg;base64,' + sheet.toString('base64'));
    }
    return { motor:'react-film-v2', runtimeHash:renderer.runtimeHash, frames, geometryFrames:measured, issues, images: sheets, geometricamenteValido: issues.length === 0, aviso: 'Revisar las imágenes: la ausencia de desbordamientos no acredita calidad estética.' };
  } finally { renderer.close(); }
}
