import type { CinematicFilm, FilmScene } from './film-schema';
export const clamp = (n: number) => Math.max(0, Math.min(1, n));
export const ease = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export type SceneState = { scene: FilmScene; index: number; frame: number; local: number; progress: number; entrance: number };
/** Toda animación depende del fotograma, nunca del reloj o efectos. */
export function sceneState(film: CinematicFilm, frame: number): SceneState {
  const f = Math.max(0, Math.min(film.fotogramas - 1, Math.floor(frame)));
  const index = film.escenas.findIndex(s => f >= s.inicio && f < s.fin);
  const scene = film.escenas[index], local = f - scene.inicio;
  return { scene, index, frame: f, local, progress: clamp(local / (scene.fin - scene.inicio - 1)), entrance: scene.transicion ? ease(local / scene.transicion) : 1 };
}
export function actionProgress(state: SceneState, id: string, action: FilmScene['acciones'][number]['accion'], fps: number, fallback: number, seconds = .8, item?: string, includeEntity = true): number {
  const matching = state.scene.acciones.filter(a => a.entidad === id && a.accion === action);
  const event = (item ? matching.find(a=>a.item===item) : undefined) ?? (includeEntity ? matching.find(a=>!a.item) : undefined);
  return ease((state.local / fps - (event ? event.en / fps : fallback)) / seconds);
}
export type FilmBox = { x: number; y: number; w: number; h: number };
export const knowledgePortal = { x: 1620, y: 490, radius: 34 };
/** Retícula con zonas de texto y visual separadas; cámara acotada. */
export function sceneBoxes(scene: FilmScene): FilmBox[] {
  switch (scene.composicion) {
    case 'editorial': return [{ x: scene.ladoVisual === 'izquierda' ? 104 : 552, y: 160, w: 1250, h: 742 }];
    case 'duo': return [{ x: 110, y: 326, w: 825, h: 490 }, { x: 985, y: 326, w: 825, h: 490 }];
    case 'trio': return [110, 684, 1258].map(x => ({ x, y: 380, w: 552, h: 328 }));
    default: return [{ x: 390, y: 300, w: 1140, h: 677 }];
  }
}

/** Proyecta el portal con el mismo origen y cámara que su plano de salida. */
export function projectedKnowledgePortal(state: SceneState) {
  const scale = mix(state.scene.camara.inicio, state.scene.camara.fin, ease(state.progress));
  return { x: 1100 + (knowledgePortal.x - 1100) * scale + state.scene.camara.recorridoX * state.progress, y: 540 + (knowledgePortal.y - 540) * scale + state.scene.camara.recorridoY * state.progress, radius: knowledgePortal.radius * scale };
}
