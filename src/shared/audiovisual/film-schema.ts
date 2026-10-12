import { z } from 'zod';
import { filmV1Schema } from './legacy-film-schema';
import { filmV2Schema } from './film-v2-schema';

export const filmSchema = z.union([filmV1Schema, filmV2Schema]);
export type Film = z.infer<typeof filmSchema>;
export type { CinematicFilm, FilmEntity, FilmScene, FilmItem } from './film-v2-schema';
