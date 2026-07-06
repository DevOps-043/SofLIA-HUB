import { normalizeVisibleText, scoreTextMatch } from './text-matching';
import type { BlockedTarget, ImagePoint, LocateOptions, PhysicalPoint, Rect, SpatialHint } from './types';

/**
 * Ranking de candidatos visible-first:
 * - Sin pista: se mantiene el comportamiento conservador de texto > area.
 * - Con pista: la region apuntada por el modelo manda. Un parcial cercano puede
 *   ganarle a un exacto lejano, y un unico exacto lejano se rechaza.
 */

const NEAR_HINT_RADIUS_PX = 180;
const FAR_HINT_RADIUS_PX = 320;
const DEFAULT_BLOCK_IMAGE_RADIUS_PX = 90;
const DEFAULT_BLOCK_PHYSICAL_RADIUS_PX = 140;

export type ScorableCandidate = {
  texto: string;
  centroImagen?: ImagePoint;
  centroFisico?: PhysicalPoint;
  bboxImagen?: Rect;
  bboxFisico?: Rect;
  area: number;
  sourceConfidence?: number;
};

export type CandidateScore<T extends ScorableCandidate> = {
  candidato: T;
  score: number;
  textScore: number;
  spatialScore: number;
  distanceImagen?: number;
  rankingReason: string;
};

export function pickBestCandidate<T extends ScorableCandidate>(
  candidatos: T[],
  textoObjetivo: string,
  options?: LocateOptions | SpatialHint,
): CandidateScore<T> | null {
  const normalizedOptions = normalizeOptions(options);
  const pista = normalizedOptions.pista;
  const matches = candidatos
    .map((candidato) => scoreCandidate(candidato, textoObjetivo, normalizedOptions))
    .filter((candidate): candidate is CandidateScore<T> => Boolean(candidate));

  if (matches.length === 0) return null;

  if (pista) {
    const candidatesNearHint = matches.filter((candidate) => isNearHint(candidate));
    if (candidatesNearHint.length === 0) return null;
    return candidatesNearHint.sort(compareWithHint)[0];
  }

  return matches.sort(compareWithoutHint)[0];
}

function scoreCandidate<T extends ScorableCandidate>(
  candidato: T,
  textoObjetivo: string,
  options: LocateOptions,
): CandidateScore<T> | null {
  const textScore = scoreTextMatch(candidato.texto, textoObjetivo);
  if (textScore <= 0) return null;
  if (isBlocked(candidato, options.bloqueados || [])) return null;

  const distanceImagen = options.pista && candidato.centroImagen
    ? distancia(candidato.centroImagen, options.pista)
    : undefined;
  const spatialScore = distanceImagen === undefined ? 0 : scoreDistance(distanceImagen);
  const confidence = candidato.sourceConfidence ?? 1;
  const score = options.pista
    ? (textScore * 1.25) + (spatialScore * 3.5) + (confidence * 0.15)
    : (textScore * 10) + (confidence * 0.1) - Math.min(candidato.area, 100000) / 100000;

  return {
    candidato,
    score,
    textScore,
    spatialScore,
    distanceImagen,
    rankingReason: buildRankingReason(textScore, spatialScore, distanceImagen, Boolean(options.pista)),
  };
}

function normalizeOptions(options?: LocateOptions | SpatialHint): LocateOptions {
  if (!options) return {};
  if (isLocateOptions(options)) return options;
  return { pista: options };
}

function isLocateOptions(options: LocateOptions | SpatialHint): options is LocateOptions {
  return Object.prototype.hasOwnProperty.call(options, 'pista')
    || Object.prototype.hasOwnProperty.call(options, 'bloqueados');
}

function isNearHint<T extends ScorableCandidate>(candidate: CandidateScore<T>): boolean {
  if (candidate.distanceImagen === undefined) return false;
  return candidate.distanceImagen <= FAR_HINT_RADIUS_PX;
}

function scoreDistance(distancePx: number): number {
  if (distancePx <= NEAR_HINT_RADIUS_PX) return 1;
  if (distancePx >= FAR_HINT_RADIUS_PX) return 0;
  return 1 - ((distancePx - NEAR_HINT_RADIUS_PX) / (FAR_HINT_RADIUS_PX - NEAR_HINT_RADIUS_PX));
}

function compareWithHint<T extends ScorableCandidate>(a: CandidateScore<T>, b: CandidateScore<T>): number {
  if (Math.abs(a.score - b.score) > 0.001) return b.score - a.score;
  if (Math.abs(a.spatialScore - b.spatialScore) > 0.001) return b.spatialScore - a.spatialScore;
  if (a.textScore !== b.textScore) return b.textScore - a.textScore;
  return (a.distanceImagen ?? Number.MAX_SAFE_INTEGER) - (b.distanceImagen ?? Number.MAX_SAFE_INTEGER);
}

function compareWithoutHint<T extends ScorableCandidate>(a: CandidateScore<T>, b: CandidateScore<T>): number {
  if (a.textScore !== b.textScore) return b.textScore - a.textScore;
  if (Math.abs(a.score - b.score) > 0.001) return b.score - a.score;
  return a.candidato.area - b.candidato.area;
}

function isBlocked(candidate: ScorableCandidate, bloqueados: BlockedTarget[]): boolean {
  return bloqueados.some((blocked) => {
    if (blocked.texto && scoreTextMatch(candidate.texto, blocked.texto) <= 0) return false;
    if (blocked.centroImagen && candidate.centroImagen) {
      const radius = blocked.radioImagen ?? DEFAULT_BLOCK_IMAGE_RADIUS_PX;
      if (distancia(candidate.centroImagen, blocked.centroImagen) <= radius) return true;
    }
    if (blocked.centroFisico && candidate.centroFisico) {
      const radius = blocked.radioFisico ?? DEFAULT_BLOCK_PHYSICAL_RADIUS_PX;
      if (distancia(candidate.centroFisico, blocked.centroFisico) <= radius) return true;
    }
    return false;
  });
}

function buildRankingReason(textScore: number, spatialScore: number, distanceImagen: number | undefined, hadHint: boolean): string {
  const textLabel = textScore === 3 ? 'texto exacto' : textScore === 2 ? 'texto prefijo' : 'texto parcial';
  if (!hadHint) return textLabel;
  if (distanceImagen === undefined) return `${textLabel}; sin coordenada de imagen`;
  return `${textLabel}; distancia pista ${Math.round(distanceImagen)}px; score espacial ${spatialScore.toFixed(2)}`;
}

function distancia(a: ImagePoint | PhysicalPoint, b: ImagePoint | PhysicalPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function sameVisibleText(a: string | undefined, b: string | undefined): boolean {
  return Boolean(a && b && normalizeVisibleText(a) === normalizeVisibleText(b));
}
